import { z } from 'zod';

import { runAudit } from '@/server/audit';
import { formatSse, SSE_HEADERS, type AuditStreamEvent } from '@/server/audit/sse';
import { hasAnyEngine, isEngineError } from '@/server/engines';

/**
 * Endpoint de auditoría AEO/GEO con progreso en vivo (Server-Sent Events).
 *
 * `POST /api/audit` con `{ brand, locale }` dispara una auditoría completa y transmite cada hito
 * del pipeline como un evento SSE a medida que ocurre, cerrando con el `AuditResult` (`done`) o
 * un evento `error`. La UI (Fase 5) consume el stream con `fetch` + `ReadableStream`.
 *
 * Vive fuera del segmento `[locale]` (el matcher de `src/proxy.ts` excluye `/api`): el idioma
 * del reporte viaja en el body, no en la ruta.
 */

// Los motores usan `server-only` + `fetch` nativo: el runtime Node es el entorno seguro.
export const runtime = 'nodejs';
// La auditoría depende de llamadas externas en vivo: nunca cachear la respuesta.
export const dynamic = 'force-dynamic';
// El pipeline real tarda decenas de segundos; subimos el tope por defecto.
// (Fase 9: validar contra los límites del plan de Vercel.)
export const maxDuration = 60;

/** Body esperado: `brand` es nombre de marca o URL; `locale` sigue al selector de la UI. */
const requestSchema = z.object({
  brand: z.string().trim().min(1).max(200),
  locale: z.enum(['es', 'en']).default('es'),
});

type RequestLocale = z.infer<typeof requestSchema>['locale'];

/**
 * Mensajes de error del endpoint, localizados por idioma. No usamos next-intl acá (es un route
 * handler fuera del segmento `[locale]`): un record por locale alcanza y mantiene el handler simple.
 */
const ERROR_MESSAGES = {
  badRequest: {
    es: 'Body inválido: se espera { brand: string, locale?: "es" | "en" }',
    en: 'Invalid body: expected { brand: string, locale?: "es" | "en" }',
  },
  noEngines: {
    es: 'No hay motores de IA configurados en el servidor',
    en: 'No AI engines are configured on the server',
  },
} satisfies Record<string, Record<RequestLocale, string>>;

/** Locale pedido de forma tolerante: aunque el resto del body sea inválido, respetamos el idioma. */
function pickLocale(body: unknown): RequestLocale {
  if (typeof body === 'object' && body !== null && 'locale' in body) {
    const value = (body as { locale: unknown }).locale;
    if (value === 'es' || value === 'en') return value;
  }
  return 'es';
}

export async function POST(request: Request): Promise<Response> {
  // 1. Validar el body. Un input inválido se rechaza antes de abrir el stream.
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // body inválido/ausente: queda en `null` y el schema lo rechaza abajo.
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: ERROR_MESSAGES.badRequest[pickLocale(body)] }, { status: 400 });
  }
  const { brand, locale } = parsed.data;

  // 2. Sin motores configurados no hay nada que auditar: 503 sin abrir el stream.
  if (!hasAnyEngine()) {
    return Response.json({ error: ERROR_MESSAGES.noEngines[locale] }, { status: 503 });
  }

  // 3. Stream SSE: cada evento de progreso del orquestador se reenvía 1:1.
  const encoder = new TextEncoder();
  // `closed` se comparte entre `start`, `cancel` y el abort del cliente: una vez cerrado, ni
  // enqueamos ni volvemos a cerrar el controller (ambas cosas lanzarían).
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AuditStreamEvent): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSse(event)));
        } catch {
          // El cliente se fue y el controller ya está cerrado/errado (el abort puede llegar sin
          // pasar por `cancel`): dejamos de emitir en vez de propagar el throw.
          closed = true;
        }
      };

      try {
        const result = await runAudit(brand, {
          locale,
          signal: request.signal,
          onProgress: (event) => send(event),
        });
        send({ type: 'done', result });
      } catch (cause) {
        // El error viaja como evento, no como throw: cortar el stream dejaría a la UI a ciegas.
        const kind = isEngineError(cause) ? cause.kind : 'unknown';
        const message = cause instanceof Error ? cause.message : 'fallo de la auditoría';
        send({ type: 'error', kind, message });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    // El cliente se desconectó: el runtime ya descartó el controller. Solo marcamos cerrado
    // para frenar el enqueue tardío; `request.signal` ya abortó las llamadas de motor en vuelo.
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
