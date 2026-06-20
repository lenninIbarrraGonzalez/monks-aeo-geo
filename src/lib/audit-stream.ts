import type { AuditStreamEvent } from '@/server/audit/sse';

/**
 * Parser incremental de un stream Server-Sent Events de auditoría.
 *
 * El route handler (`/api/audit`) serializa cada evento como `event: <type>\ndata: <json>\n\n`.
 * El cuerpo (`data:`) ya lleva el `type` dentro del JSON, así que basta con parsear esa línea.
 * Mantiene un buffer porque un chunk de red puede cortar un evento por la mitad o traer varios
 * juntos; solo emite los bloques que ya llegaron completos (cerrados por la doble línea en blanco).
 *
 * Se aísla de React a propósito para poder testearlo como función pura (Fase 8).
 */
export function createAuditStreamParser() {
  let buffer = '';

  return {
    /** Acumula un chunk decodificado y devuelve los eventos completos disponibles tras él. */
    push(chunk: string): AuditStreamEvent[] {
      buffer += chunk;
      const events: AuditStreamEvent[] = [];

      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const event = parseBlock(block);
        if (event) events.push(event);
        separator = buffer.indexOf('\n\n');
      }

      return events;
    },
  };
}

/** Extrae el `AuditStreamEvent` de un bloque SSE; ignora bloques sin `data:` o con JSON inválido. */
function parseBlock(block: string): AuditStreamEvent | null {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!data) return null;

  try {
    return JSON.parse(data) as AuditStreamEvent;
  } catch {
    return null;
  }
}
