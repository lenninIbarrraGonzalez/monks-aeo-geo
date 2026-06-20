/**
 * Fakes compartidos para los tests del motor de auditoría.
 * No es un archivo de test (no matchea `*.test.ts`): se importa desde los tests reales.
 */

import type { Engine } from '@/server/engines';
import type { EngineId, EngineRequest, EngineResponse } from '@/types/engine';

/** Motor falso que devuelve respuestas encoladas (la última se repite si se agotan). */
export function fakeEngine(responses: string[], id: EngineId = 'gemini'): Engine {
  let i = 0;
  return {
    id,
    label: id.toUpperCase(),
    model: `${id}-model`,
    async generate(): Promise<EngineResponse> {
      const text = responses[Math.min(i, responses.length - 1)] ?? '';
      i++;
      return { engineId: id, label: id.toUpperCase(), model: `${id}-model`, text };
    },
  };
}

/** Motor falso cuyo `generate` siempre lanza (simula fallo de proveedor). */
export function throwingEngine(id: EngineId = 'groq'): Engine {
  return {
    id,
    label: id.toUpperCase(),
    model: `${id}-model`,
    async generate(): Promise<EngineResponse> {
      throw new Error('boom');
    },
  };
}

/** Motor falso que invoca un callback por cada respuesta y devuelve un texto fijo. */
export function spyEngine(
  text: string,
  id: EngineId = 'gemini',
  onCall?: (request: EngineRequest) => void,
): Engine {
  return {
    id,
    label: id.toUpperCase(),
    model: `${id}-model`,
    async generate(request: EngineRequest): Promise<EngineResponse> {
      onCall?.(request);
      return { engineId: id, label: id.toUpperCase(), model: `${id}-model`, text };
    },
  };
}
