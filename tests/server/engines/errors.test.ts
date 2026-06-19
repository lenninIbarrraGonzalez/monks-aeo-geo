import { describe, expect, it } from 'vitest';
import {
  EngineError,
  isEngineError,
  isRetryableStatus,
  kindFromStatus,
  parseRetryAfterMs,
} from '@/server/engines/errors';

describe('EngineError', () => {
  it('expone kind, status y retryable, y por defecto no es retryable', () => {
    const err = new EngineError('boom', { kind: 'server', engineId: 'gemini', status: 503 });
    expect(err.name).toBe('EngineError');
    expect(err.kind).toBe('server');
    expect(err.engineId).toBe('gemini');
    expect(err.status).toBe(503);
    expect(err.retryable).toBe(false);
    expect(isEngineError(err)).toBe(true);
  });

  it('isEngineError distingue de errores comunes', () => {
    expect(isEngineError(new Error('x'))).toBe(false);
    expect(isEngineError(null)).toBe(false);
  });
});

describe('isRetryableStatus', () => {
  it('marca 429 y 5xx como reintentables', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('no reintenta 4xx que no sean 429', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

describe('kindFromStatus', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limit'],
    [500, 'server'],
    [502, 'server'],
    [418, 'unknown'],
  ] as const)('mapea %i → %s', (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe('parseRetryAfterMs', () => {
  it('parsea segundos a milisegundos', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs('0')).toBe(0);
  });

  it('parsea una fecha HTTP futura', () => {
    const future = new Date(Date.now() + 5_000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5_000);
  });

  it('devuelve undefined si está ausente o no es parseable', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('no-soy-fecha')).toBeUndefined();
  });
});
