/**
 * Tipos compartidos de la capa de motores de IA.
 *
 * Estos tipos son el contrato entre la auditoría (Fase 3) y los adaptadores de cada
 * proveedor. La auditoría trabaja siempre contra estos tipos, nunca contra la API de un
 * proveedor concreto: agregar o quitar un motor no toca la lógica de auditoría.
 */

/** Identificador estable de cada motor soportado. */
export type EngineId = 'gemini' | 'groq' | 'openrouter';

/** Rol de un mensaje en una conversación estilo chat. */
export type ChatRole = 'system' | 'user' | 'assistant';

/** Mensaje individual de una conversación. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Pedido de generación independiente del proveedor.
 *
 * Se puede pasar un `prompt` simple (se convierte en un único mensaje `user`) o una lista
 * de `messages` para conversaciones con contexto. Si se pasan ambos, mandan los `messages`.
 */
export interface EngineRequest {
  /** Prompt de usuario simple. Atajo para `messages: [{ role: 'user', content: prompt }]`. */
  prompt?: string;
  /** Conversación completa. Tiene prioridad sobre `prompt` si ambos están presentes. */
  messages?: ChatMessage[];
  /** Temperatura de muestreo (0–2 según el proveedor). */
  temperature?: number;
  /** Tope de tokens de salida. */
  maxTokens?: number;
  /**
   * Pide al proveedor que responda en modo JSON nativo (Gemini `responseMimeType`,
   * OpenAI-compatible `response_format`). El llamador igual debe instruir el formato en el
   * prompt y validar la salida; este flag solo reduce que el modelo agregue prosa alrededor.
   */
  json?: boolean;
  /** Señal externa de cancelación, combinada con el timeout interno. */
  signal?: AbortSignal;
}

/** Conteo de tokens normalizado entre proveedores (cuando lo reportan). */
export interface EngineUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Respuesta normalizada de un motor.
 *
 * Siempre etiqueta qué motor y modelo la produjeron: el reporte nunca debe atribuir una
 * respuesta a "ChatGPT" si la generó otro modelo (decisión de honestidad del plan).
 */
export interface EngineResponse {
  engineId: EngineId;
  /** Nombre legible del motor para la UI (p. ej. "Gemini 2.0 Flash"). */
  label: string;
  /** Modelo exacto que respondió (p. ej. "gemini-2.0-flash"). */
  model: string;
  /** Texto generado, ya concatenado y recortado. */
  text: string;
  /** Uso de tokens, si el proveedor lo reporta. */
  usage?: EngineUsage;
  /** Razón de finalización del proveedor (p. ej. "stop", "length"). */
  finishReason?: string;
  /** Payload crudo del proveedor, por si la auditoría necesita inspeccionarlo. */
  raw?: unknown;
}

/** Categoría normalizada de error de un motor, para decidir reintentos y mensajes. */
export type EngineErrorKind =
  | 'auth' // credenciales inválidas o ausentes (401/403)
  | 'rate_limit' // límite de tasa excedido (429)
  | 'timeout' // se agotó el tiempo de espera / aborto
  | 'network' // fallo de red antes de obtener respuesta
  | 'invalid_response' // respuesta 2xx pero con forma inesperada
  | 'server' // error del proveedor (5xx)
  | 'unknown';
