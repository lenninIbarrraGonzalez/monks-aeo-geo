/**
 * Protocolo de eventos del stream de auditoría (Server-Sent Events).
 *
 * Define el contrato del wire entre el route handler (`/api/audit`, Fase 4) y la UI que lo
 * consume (Fase 5), y serializa cada evento al formato SSE. El núcleo (`runAudit`) emite
 * `AuditProgress`; aquí lo extendemos con dos eventos terminales (`done` / `error`) y lo
 * convertimos a texto. Es la única pieza con lógica propia de esta capa, por eso vive aparte y
 * va testeada.
 */

import type { EngineErrorKind } from '@/types/engine';
import type { AuditProgress, AuditResult } from './types';

/** `kind` del evento terminal de error: reutiliza la taxonomía de la capa de motores. */
export type AuditErrorKind = EngineErrorKind | 'bad_request';

/**
 * Evento que viaja por el stream SSE.
 *
 * Es `AuditProgress` (hitos del pipeline) más dos terminales:
 * - `done`: la auditoría terminó OK; lleva el `AuditResult` completo.
 * - `error`: algo falló; `kind` deja a la UI distinguir `auth` / `rate_limit` / etc.
 */
export type AuditStreamEvent =
  | AuditProgress
  | { type: 'done'; result: AuditResult }
  | { type: 'error'; kind: AuditErrorKind | 'unknown'; message: string };

/**
 * Serializa un evento al formato Server-Sent Events.
 *
 * `event: <type>` permite a la UI hacer `switch` por tipo sin parsear el JSON; `data: <json>`
 * lleva el payload completo. El bloque cierra con la doble línea en blanco que exige el spec.
 */
export function formatSse(event: AuditStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Cabeceras de una respuesta SSE: sin caché ni buffering intermedio para que fluya en vivo. */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};
