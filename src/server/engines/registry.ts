import 'server-only';

import type { EngineId } from '@/types/engine';
import type { Engine } from './base';
import { getGeminiConfig, getGroqConfig, getOpenRouterConfig } from './env';
import { createGeminiEngine } from './gemini';
import { createGroqEngine } from './groq';
import { createOpenRouterEngine } from './openrouter';

/**
 * Registro central de motores disponibles.
 *
 * Único punto que la auditoría (Fase 3) consulta para descubrir qué motores puede usar. Cada
 * motor se construye solo si su key está presente en el entorno: sin credenciales, no aparece
 * en la lista y la auditoría sigue funcionando con los que sí estén (degradado elegante).
 */

/** Constructores de motor, en orden de preferencia. */
const builders: Array<() => Engine | null> = [
  () => {
    const config = getGeminiConfig();
    return config ? createGeminiEngine(config) : null;
  },
  () => {
    const config = getGroqConfig();
    return config ? createGroqEngine(config) : null;
  },
  () => {
    const config = getOpenRouterConfig();
    return config ? createOpenRouterEngine(config) : null;
  },
];

/** Devuelve todos los motores cuya configuración (key) está presente en el entorno. */
export function getAvailableEngines(): Engine[] {
  return builders.map((build) => build()).filter((engine): engine is Engine => engine !== null);
}

/** Devuelve el motor con el `id` dado si está disponible, o `undefined`. */
export function getEngine(id: EngineId): Engine | undefined {
  return getAvailableEngines().find((engine) => engine.id === id);
}

/** Indica si hay al menos un motor configurado y disponible. */
export function hasAnyEngine(): boolean {
  return getAvailableEngines().length > 0;
}
