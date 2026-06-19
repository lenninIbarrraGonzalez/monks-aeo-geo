import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngineError } from '@/server/engines/errors';
import { fetchWithRetry } from '@/server/engines/http';

/** Respuesta mock rápida de construir con status y headers arbitrarios. */
function res(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

const FAST = { engineId: 'gemini', baseDelayMs: 0, maxDelayMs: 0 } as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchWithRetry', () => {
  it('devuelve la respuesta cuando es OK al primer intento', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res('ok', 200));
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchWithRetry('https://x', {}, FAST);

    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reintenta en 500 y termina devolviendo el éxito', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res('boom', 500))
      .mockResolvedValueOnce(res('ok', 200));
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchWithRetry('https://x', {}, FAST);

    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reintenta en 429 respetando Retry-After', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res('slow down', 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(res('ok', 200));
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchWithRetry('https://x', {}, FAST);

    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('corta tras agotar maxRetries y lanza el último error clasificado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res('down', 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('https://x', {}, { ...FAST, maxRetries: 2 })).rejects.toMatchObject(
      { kind: 'server', status: 503, retryable: true },
    );
    // 1 intento inicial + 2 reintentos
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('no reintenta un 401 y lo lanza como auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res('nope', 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('https://x', {}, FAST)).rejects.toMatchObject({
      kind: 'auth',
      status: 401,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborta por timeout y lanza EngineError kind timeout', async () => {
    // fetch que solo se rechaza cuando se aborta la señal interna del timeout.
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithRetry('https://x', {}, { ...FAST, timeoutMs: 10, maxRetries: 0 }),
    ).rejects.toMatchObject({ kind: 'timeout', retryable: true });
  });

  it('no reintenta cuando la señal externa se cancela', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('https://x', {}, { ...FAST, signal: controller.signal });
    controller.abort();

    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).kind).toBe('timeout');
    expect((err as EngineError).retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
