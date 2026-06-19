import 'server-only';

import type { EngineId, EngineRequest, EngineResponse, EngineUsage } from '@/types/engine';
import { toChatMessages, type Engine } from './base';
import { EngineError } from './errors';
import { fetchWithRetry } from './http';

/**
 * Fábrica compartida para motores con API OpenAI-compatible (`/chat/completions`).
 *
 * OpenRouter y Groq exponen el mismo esquema de request (`model` + `messages[]`) y de
 * respuesta (`choices[0].message.content` + `usage`), así que la lógica vive acá una sola vez
 * y cada proveedor solo aporta su URL, headers y label.
 */
export interface OpenAICompatibleOptions {
  engineId: EngineId;
  /** Nombre legible para la UI. */
  label: string;
  /** Modelo a invocar. */
  model: string;
  /** Endpoint de chat completions del proveedor. */
  url: string;
  /** Nombre del proveedor para los mensajes de error (p. ej. "OpenRouter"). */
  providerName: string;
  /** Headers específicos del proveedor (auth + atribución). El `content-type` se agrega solo. */
  headers: Record<string, string>;
}

/** Forma mínima de la respuesta OpenAI-compatible que parseamos. */
interface ChatCompletionBody {
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

/** Capitaliza cada segmento de un id de modelo para un label legible. */
export function labelFromModel(model: string): string {
  const name = model.split('/').pop() ?? model;
  const withoutFree = name.replace(/:free$/, '');
  return withoutFree
    .split('-')
    .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');
}

/** Crea un motor que habla con un endpoint OpenAI-compatible de chat completions. */
export function createOpenAICompatibleEngine(options: OpenAICompatibleOptions): Engine {
  const { engineId, label, model, url, providerName, headers } = options;

  return {
    id: engineId,
    label,
    model,

    async generate(request: EngineRequest): Promise<EngineResponse> {
      const messages = toChatMessages(request);
      if (messages.length === 0) {
        throw new EngineError('Pedido sin prompt ni mensajes', {
          kind: 'invalid_response',
          engineId,
        });
      }

      const body = {
        model,
        messages,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
      };

      const response = await fetchWithRetry(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
        },
        { engineId, signal: request.signal },
      );

      let parsed: ChatCompletionBody;
      try {
        parsed = (await response.json()) as ChatCompletionBody;
      } catch (cause) {
        throw new EngineError(`Respuesta de ${providerName} no es JSON válido`, {
          kind: 'invalid_response',
          engineId,
          cause,
        });
      }

      const choice = parsed.choices?.[0];
      const text = (choice?.message?.content ?? '').trim();

      if (!choice || text.length === 0) {
        throw new EngineError(`${providerName} no devolvió contenido`, {
          kind: 'invalid_response',
          engineId,
        });
      }

      const usage: EngineUsage | undefined = parsed.usage && {
        promptTokens: parsed.usage.prompt_tokens,
        completionTokens: parsed.usage.completion_tokens,
        totalTokens: parsed.usage.total_tokens,
      };

      return {
        engineId,
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
