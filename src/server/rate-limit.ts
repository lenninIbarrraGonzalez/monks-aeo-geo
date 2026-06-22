import 'server-only';

/**
 * Rate-limiter en memoria con ventana deslizante, por clave (típicamente la IP del cliente).
 *
 * El endpoint `/api/audit` es anónimo y cada request dispara varias llamadas LLM: sin un tope, es
 * un vector de abuso de cuota/costo. Esto es una primera barrera, deliberadamente simple. En
 * serverless el estado vive por instancia (no se comparte entre lambdas), así que para producción
 * conviene un store compartido (p. ej. Vercel KV / Upstash); la interfaz queda igual.
 *
 * Se inyecta `now` para poder testearlo sin depender del reloj real.
 */

export interface RateLimiterOptions {
  /** Máximo de solicitudes permitidas dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana, en ms. */
  windowMs: number;
  /** Fuente de tiempo (default `Date.now`); inyectable para tests. */
  now?: () => number;
}

export interface RateLimitResult {
  /** `true` si la solicitud está dentro del límite. */
  allowed: boolean;
  /** Solicitudes restantes en la ventana actual (0 si se superó). */
  remaining: number;
  /** Ms hasta que se libere un cupo (solo relevante cuando `allowed` es `false`). */
  retryAfterMs: number;
}

export interface RateLimiter {
  /** Registra un intento de `key` y dice si está permitido. */
  check(key: string): RateLimitResult;
}

/** Crea un rate-limiter de ventana deslizante en memoria. */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs, now = Date.now } = options;
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const current = now();
      const windowStart = current - windowMs;

      // Descartamos los timestamps fuera de la ventana antes de evaluar.
      const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);

      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? current;
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, oldest + windowMs - current),
        };
      }

      recent.push(current);
      hits.set(key, recent);
      return { allowed: true, remaining: limit - recent.length, retryAfterMs: 0 };
    },
  };
}
