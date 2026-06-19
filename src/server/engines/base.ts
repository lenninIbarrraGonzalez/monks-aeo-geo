import type { ChatMessage, EngineId, EngineRequest, EngineResponse } from '@/types/engine';

/**
 * Contrato común de todo motor de IA.
 *
 * La auditoría (Fase 3) depende solo de esta interfaz: itera los motores disponibles y llama
 * `generate()` sin saber qué proveedor hay detrás. Cada adaptador concreto (Gemini, OpenRouter)
 * la implementa traduciendo desde/hacia la API de su proveedor.
 */
export interface Engine {
  /** Identificador estable del motor. */
  readonly id: EngineId;
  /** Nombre legible para la UI (p. ej. "Gemini 2.0 Flash"). */
  readonly label: string;
  /** Modelo exacto que usa este motor. */
  readonly model: string;
  /** Ejecuta un pedido y devuelve la respuesta normalizada. */
  generate(request: EngineRequest): Promise<EngineResponse>;
}

/**
 * Normaliza un {@link EngineRequest} a una lista de mensajes de chat.
 * Prioriza `messages`; si no hay, usa `prompt` como único mensaje de usuario.
 */
export function toChatMessages(request: EngineRequest): ChatMessage[] {
  if (request.messages && request.messages.length > 0) return request.messages;
  if (request.prompt) return [{ role: 'user', content: request.prompt }];
  return [];
}
