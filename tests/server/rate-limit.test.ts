import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '@/server/rate-limit';

describe('createRateLimiter', () => {
  it('permite hasta `limit` solicitudes y bloquea la siguiente', () => {
    const now = 1_000;
    const limiter = createRateLimiter({ limit: 3, windowMs: 1_000, now: () => now });

    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);
    const third = limiter.check('ip');
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = limiter.check('ip');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('aísla las claves entre sí', () => {
    const now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => now });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    // Otra IP arranca con su propio cupo.
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('libera cupo cuando la ventana se desliza', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => now });

    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(false);

    now += 1_001; // la primera marca cae fuera de la ventana
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('reporta `retryAfterMs` acorde al timestamp más viejo de la ventana', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => now });

    limiter.check('ip'); // ts = 0
    now = 400;
    const blocked = limiter.check('ip');
    expect(blocked.allowed).toBe(false);
    // El cupo se libera en t=1000; faltan 600ms.
    expect(blocked.retryAfterMs).toBe(600);
  });
});
