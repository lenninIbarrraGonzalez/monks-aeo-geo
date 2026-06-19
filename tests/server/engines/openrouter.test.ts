import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenRouterEngine } from '@/server/engines/openrouter';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const engine = createOpenRouterEngine({
  apiKey: 'k',
  model: 'meta-llama/llama-3.3-70b-instruct:free',
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createOpenRouterEngine', () => {
  it('deriva un label legible del id de modelo (sin :free)', () => {
    expect(engine.id).toBe('openrouter');
    expect(engine.label).toBe('Llama 3.3 70b Instruct');
  });

  it('mapea una respuesta OK a EngineResponse normalizada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        choices: [{ message: { content: '  Hi there  ' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await engine.generate({ prompt: 'Hello' });

    expect(result.engineId).toBe('openrouter');
    expect(result.text).toBe('Hi there');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({ promptTokens: 4, completionTokens: 2, totalTokens: 6 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('openrouter.ai');
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer k' });
  });

  it('reintenta en 429 con Retry-After y luego responde', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: 'rate' }, 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await engine.generate({ prompt: 'x' });

    expect(result.text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lanza invalid_response si choices viene vacío', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ choices: [] })));
    await expect(engine.generate({ prompt: 'x' })).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
