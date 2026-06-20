import 'server-only';

import type { EngineRequest, EngineResponse, EngineUsage } from '@/types/engine';
import { toChatMessages, type Engine } from './base';
import type { EngineConfig } from './env';
import { EngineError } from './errors';
import { fetchWithRetry } from './http';

const ENGINE_ID = 'gemini' as const;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Convierte el id de modelo en un label legible (p. ej. "Gemini 2.0 Flash"). */
function toLabel(model: string): string {
  const pretty = model
    .split('-')
    .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');
  return `Gemini ${pretty.replace(/^Gemini\s*/i, '')}`.trim();
}

/** Forma mínima de la respuesta de Gemini que nos interesa parsear. */
interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Crea un motor que habla con la API de Gemini (Google AI Studio, free tier).
 *
 * Mapea los mensajes de chat al formato `contents` de Gemini (rol `assistant` → `model`,
 * los mensajes `system` se agregan como `systemInstruction`) y normaliza la respuesta a
 * {@link EngineResponse}.
 */
export function createGeminiEngine(config: EngineConfig): Engine {
  const { apiKey, model } = config;
  const label = toLabel(model);

  return {
    id: ENGINE_ID,
    label,
    model,

    async generate(request: EngineRequest): Promise<EngineResponse> {
      const messages = toChatMessages(request);
      if (messages.length === 0) {
        throw new EngineError('Pedido sin prompt ni mensajes', {
          kind: 'invalid_response',
          engineId: ENGINE_ID,
        });
      }

      const systemText = messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');

      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.maxTokens !== undefined && { maxOutputTokens: request.maxTokens }),
          ...(request.json && { responseMimeType: 'application/json' }),
        },
      };
      if (systemText) {
        body.systemInstruction = { parts: [{ text: systemText }] };
      }

      const response = await fetchWithRetry(
        `${API_BASE}/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
        },
        { engineId: ENGINE_ID, signal: request.signal },
      );

      let parsed: GeminiResponseBody;
      try {
        parsed = (await response.json()) as GeminiResponseBody;
      } catch (cause) {
        throw new EngineError('Respuesta de Gemini no es JSON válido', {
          kind: 'invalid_response',
          engineId: ENGINE_ID,
          cause,
        });
      }

      const candidate = parsed.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!candidate || text.length === 0) {
        throw new EngineError('Gemini no devolvió contenido', {
          kind: 'invalid_response',
          engineId: ENGINE_ID,
        });
      }

      const usage: EngineUsage | undefined = parsed.usageMetadata && {
        promptTokens: parsed.usageMetadata.promptTokenCount,
        completionTokens: parsed.usageMetadata.candidatesTokenCount,
        totalTokens: parsed.usageMetadata.totalTokenCount,
      };

      return {
        engineId: ENGINE_ID,
        label,
        model,
        text,
        ...(usage && { usage }),
        ...(candidate.finishReason && { finishReason: candidate.finishReason }),
        raw: parsed,
      };
    },
  };
}
