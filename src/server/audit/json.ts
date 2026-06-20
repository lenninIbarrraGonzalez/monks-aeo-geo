import 'server-only';

import type { z } from 'zod';
import type { Engine } from '@/server/engines';
import { EngineError, isEngineError } from '@/server/engines';
import type { ChatMessage } from '@/types/engine';

/**
 * Llamadas LLM con salida estructurada validada con Zod.
 *
 * El juez y la detección de perfil necesitan JSON confiable. Activamos el modo JSON nativo del
 * proveedor (`json: true`), pero como red de seguridad igual extraemos el primer objeto/array
 * balanceado (por si el modelo agrega prosa o fences ```` ```json ````), validamos con el schema
 * y, si falla, reintentamos UNA vez reinyectando el error de validación.
 */

/** Quita fences de markdown y recorta al primer objeto/array JSON balanceado del texto. */
export function extractJsonText(raw: string): string | null {
  const text = raw.trim();
  if (text.length === 0) return null;

  // Caso feliz: ya es JSON puro.
  const first = text[0];
  if (first === '{' || first === '[') {
    const balanced = sliceBalanced(text, 0);
    if (balanced) return balanced;
  }

  // Buscar el primer abre-objeto/array y recortar desde ahí.
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      const balanced = sliceBalanced(text, i);
      if (balanced) return balanced;
    }
  }
  return null;
}

/** Devuelve la subcadena `[start, fin]` del JSON balanceado que abre en `start`, o `null`. */
function sliceBalanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parámetros de una llamada estructurada. */
export interface StructuredRequest<T> {
  schema: z.ZodType<T>;
  /** Instrucción de sistema (rol y reglas del modelo). */
  system: string;
  /** Mensaje de usuario con la tarea concreta. */
  user: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Genera y valida una salida estructurada de `engine`. Reintenta una vez ante JSON inválido o
 * que no pasa el schema; si el segundo intento también falla, lanza un {@link EngineError}.
 */
export async function generateStructured<T>(
  engine: Engine,
  request: StructuredRequest<T>,
): Promise<T> {
  const { schema, system, user, temperature, maxTokens, signal } = request;

  const baseMessages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  let lastIssue = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: ChatMessage[] =
      attempt === 0
        ? baseMessages
        : [
            ...baseMessages,
            {
              role: 'user',
              content: `Tu respuesta anterior no fue JSON válido para el formato pedido (${lastIssue}). Devolvé SOLO el objeto JSON, sin texto adicional ni fences.`,
            },
          ];

    const response = await engine.generate({
      messages,
      json: true,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      ...(signal && { signal }),
    });

    const jsonText = extractJsonText(response.text);
    if (!jsonText) {
      lastIssue = 'no se encontró JSON en la salida';
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(jsonText);
    } catch {
      lastIssue = 'JSON sintácticamente inválido';
      continue;
    }

    const result = schema.safeParse(data);
    if (result.success) return result.data;
    lastIssue = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  }

  throw new EngineError(`Salida estructurada inválida tras 2 intentos: ${lastIssue}`, {
    kind: 'invalid_response',
    engineId: engine.id,
  });
}

/** Re-export para callers que quieran distinguir errores del motor. */
export { isEngineError };
