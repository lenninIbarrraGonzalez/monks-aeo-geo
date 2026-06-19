import type { EngineErrorKind, EngineId } from '@/types/engine';

/** Opciones para construir un {@link EngineError}. */
export interface EngineErrorOptions {
  kind: EngineErrorKind;
  engineId?: EngineId;
  /** Código HTTP asociado, si lo hubo. */
  status?: number;
  /** Si la operación se puede reintentar (429 y 5xx). */
  retryable?: boolean;
  /** Espera sugerida antes de reintentar (de `Retry-After`), en ms. */
  retryAfterMs?: number;
  /** Error original que se está envolviendo. */
  cause?: unknown;
}

/**
 * Error normalizado de la capa de motores.
 *
 * Unifica fallos de red, HTTP y de parsing bajo una sola clase con un `kind` clasificado,
 * para que la auditoría y la UI decidan qué hacer sin inspeccionar detalles del proveedor.
 */
export class EngineError extends Error {
  readonly kind: EngineErrorKind;
  readonly engineId?: EngineId;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(message: string, options: EngineErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'EngineError';
    this.kind = options.kind;
    this.engineId = options.engineId;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/** Type guard para distinguir un {@link EngineError} de cualquier otro error. */
export function isEngineError(error: unknown): error is EngineError {
  return error instanceof EngineError;
}

/** Indica si un código HTTP es reintentable (límite de tasa o error del servidor). */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Mapea un código HTTP de error a su categoría normalizada. */
export function kindFromStatus(status: number): EngineErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'unknown';
}

/**
 * Parsea el header `Retry-After` (segundos o fecha HTTP) a milisegundos.
 * Devuelve `undefined` si está ausente o no es parseable.
 */
export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}
