import 'server-only';

/**
 * Lectura tipada de la configuración de cada motor desde variables de entorno.
 *
 * Las claves viven solo en el servidor (`.env.local`, git-ignored) y nunca se exponen al
 * cliente. Si falta la key de un motor, su `getConfig` devuelve `null`: el registry lo
 * interpreta como "motor no disponible" y degrada con elegancia, sin romper.
 */

/** Modelo por defecto de Gemini (free tier de Google AI Studio). */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Modelo por defecto de Groq (free tier, sin tarjeta). */
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/** Modelo por defecto de OpenRouter (sufijo `:free`, sin costo). */
export const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

/** Configuración resuelta de un motor con la key presente. */
export interface EngineConfig {
  apiKey: string;
  model: string;
}

/** Lee y normaliza una variable de entorno: `undefined` si está vacía o ausente. */
function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Configuración de Gemini, o `null` si no hay `GEMINI_API_KEY`.
 * El modelo se puede sobrescribir con `GEMINI_MODEL`.
 */
export function getGeminiConfig(): EngineConfig | null {
  const apiKey = readEnv('GEMINI_API_KEY');
  if (!apiKey) return null;
  return { apiKey, model: readEnv('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL };
}

/**
 * Configuración de Groq, o `null` si no hay `GROQ_API_KEY`.
 * El modelo se puede sobrescribir con `GROQ_MODEL`.
 */
export function getGroqConfig(): EngineConfig | null {
  const apiKey = readEnv('GROQ_API_KEY');
  if (!apiKey) return null;
  return { apiKey, model: readEnv('GROQ_MODEL') ?? DEFAULT_GROQ_MODEL };
}

/**
 * Configuración de OpenRouter, o `null` si no hay `OPENROUTER_API_KEY`.
 * El modelo se puede sobrescribir con `OPENROUTER_MODEL`.
 */
export function getOpenRouterConfig(): EngineConfig | null {
  const apiKey = readEnv('OPENROUTER_API_KEY');
  if (!apiKey) return null;
  return { apiKey, model: readEnv('OPENROUTER_MODEL') ?? DEFAULT_OPENROUTER_MODEL };
}
