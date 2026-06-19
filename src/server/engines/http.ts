import 'server-only';

import type { EngineId } from '@/types/engine';
import { EngineError, isRetryableStatus, kindFromStatus, parseRetryAfterMs } from './errors';

/** Opciones del wrapper de `fetch` con timeout y reintentos. */
export interface FetchWithRetryOptions {
  /** Motor que origina la llamada, para etiquetar los errores. */
  engineId: EngineId;
  /** Tiempo máximo por intento, en ms. Por defecto 30 s. */
  timeoutMs?: number;
  /** Reintentos adicionales tras el primer intento. Por defecto 2. */
  maxRetries?: number;
  /** Backoff base, en ms. Por defecto 500 ms. */
  baseDelayMs?: number;
  /** Tope del backoff, en ms. Por defecto 8 s. */
  maxDelayMs?: number;
  /** Señal externa de cancelación (se combina con el timeout interno). */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8_000;

/** Espera `ms` milisegundos. Cancelable vía `signal`. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Backoff exponencial con jitter completo, acotado a `maxDelayMs`. */
function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.random() * exponential;
}

/**
 * `fetch` con timeout (`AbortController`) y reintentos con backoff exponencial + jitter.
 *
 * Reintenta solo errores reintentables (429 y 5xx) y fallos de red, respetando el header
 * `Retry-After` cuando está presente. Cualquier fallo terminal se lanza ya clasificado como
 * {@link EngineError}. Las respuestas no-OK no reintentables (p. ej. 401) se lanzan de una.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: FetchWithRetryOptions,
): Promise<Response> {
  const {
    engineId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    signal,
  } = options;

  let lastError: EngineError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const onExternalAbort = () => timeoutController.abort(signal?.reason);
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: timeoutController.signal });
    } catch (cause) {
      // El aborto externo no se reintenta: es una cancelación deliberada del llamador.
      if (signal?.aborted) {
        throw new EngineError('Solicitud cancelada', {
          kind: 'timeout',
          engineId,
          retryable: false,
          cause,
        });
      }
      const timedOut = timeoutController.signal.aborted;
      lastError = new EngineError(timedOut ? `Timeout tras ${timeoutMs} ms` : 'Fallo de red', {
        kind: timedOut ? 'timeout' : 'network',
        engineId,
        retryable: true,
        cause,
      });
      if (attempt < maxRetries) {
        await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs), signal);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }

    if (response.ok) return response;

    const status = response.status;
    const retryable = isRetryableStatus(status);
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    const body = await response.text().catch(() => '');
    lastError = new EngineError(
      `El motor respondió ${status}${body ? `: ${body.slice(0, 300)}` : ''}`,
      { kind: kindFromStatus(status), engineId, status, retryable, retryAfterMs },
    );

    if (!retryable || attempt >= maxRetries) throw lastError;

    const delay = retryAfterMs ?? backoffDelay(attempt, baseDelayMs, maxDelayMs);
    await sleep(delay, signal);
  }

  // Inalcanzable: el bucle siempre retorna o lanza. Defensa para el type-checker.
  throw (
    lastError ??
    new EngineError('Fallo desconocido en fetchWithRetry', {
      kind: 'unknown',
      engineId,
    })
  );
}
