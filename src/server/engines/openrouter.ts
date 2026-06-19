import 'server-only';

import type { EngineRequest, EngineResponse, EngineUsage } from '@/types/engine';
import { toChatMessages, type Engine } from './base';
import type { EngineConfig } from './env';
import { EngineError } from './errors';
import { fetchWithRetry } from './http';

const ENGINE_ID = 'openrouter' as const;
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Headers opcionales de atribución que OpenRouter usa para rankings.
 * Configurables por env; no son obligatorios para que la llamada funcione.
 */
const REFERER = process.env.OPENROUTER_SITE_URL ?? 'https://aeo-geo-auditor.vercel.app';
const TITLE = process.env.OPENROUTER_SITE_NAME ?? 'AEO/GEO Auditor';

/** Deriva un label legible del id de modelo de OpenRouter (p. ej. "Llama 3.3 70B Instruct"). */
function toLabel(model: string): string {
  const name = model.split('/').pop() ?? model;
  const withoutFree = name.replace(/:free$/, '');
  const pretty = withoutFree
    .split('-')
    .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');
  return pretty;
}

/** Forma mínima de la respuesta OpenAI-compatible que parseamos. */
interface OpenRouterResponseBody {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Crea un motor que habla con la API OpenAI-compatible de OpenRouter (modelos `:free`).
 *
 * Reenvía los mensajes de chat tal cual (mismo esquema `role`/`content`) y normaliza la
 * respuesta `choices[0].message.content` a {@link EngineResponse}.
 */
export function createOpenRouterEngine(config: EngineConfig): Engine {
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

      const body = {
        model,
        messages,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
      };

      const response = await fetchWithRetry(
        API_URL,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': REFERER,
            'X-Title': TITLE,
          },
          body: JSON.stringify(body),
        },
        { engineId: ENGINE_ID, signal: request.signal },
      );

      let parsed: OpenRouterResponseBody;
      try {
        parsed = (await response.json()) as OpenRouterResponseBody;
      } catch (cause) {
        throw new EngineError('Respuesta de OpenRouter no es JSON válido', {
          kind: 'invalid_response',
          engineId: ENGINE_ID,
          cause,
        });
      }

      const choice = parsed.choices?.[0];
      const text = (choice?.message?.content ?? '').trim();

      if (!choice || text.length === 0) {
        throw new EngineError('OpenRouter no devolvió contenido', {
          kind: 'invalid_response',
          engineId: ENGINE_ID,
        });
      }

      const usage: EngineUsage | undefined = parsed.usage && {
        promptTokens: parsed.usage.prompt_tokens,
        completionTokens: parsed.usage.completion_tokens,
        totalTokens: parsed.usage.total_tokens,
      };

      return {
        engineId: ENGINE_ID,
        label,
        model,
        text,
        ...(usage && { usage }),
        ...(choice.finish_reason && { finishReason: choice.finish_reason }),
        raw: parsed,
      };
    },
  };
}
