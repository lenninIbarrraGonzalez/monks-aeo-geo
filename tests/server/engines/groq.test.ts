import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGroqEngine } from '@/server/engines/groq';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const engine = createGroqEngine({ apiKey: 'k', model: 'llama-3.3-70b-versatile' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createGroqEngine', () => {
  it('expone id groq y label legible derivado del modelo', () => {
    expect(engine.id).toBe('groq');
    expect(engine.label).toBe('Llama 3.3 70b Versatile');
  });

  it('pega al endpoint de Groq con Bearer y mapea la respuesta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        choices: [{ message: { content: 'AEO es ...' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await engine.generate({ prompt: '¿Qué es AEO?' });

    expect(result.engineId).toBe('groq');
    expect(result.text).toBe('AEO es ...');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('api.groq.com');
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer k' });
  });

  it('lanza invalid_response si choices viene vacío', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ choices: [] })));
    await expect(engine.generate({ prompt: 'x' })).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('pide response_format json_object cuando request.json es true', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ choices: [{ message: { content: '{}' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await engine.generate({ prompt: 'x', json: true });

    const [, init] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.response_format).toEqual({ type: 'json_object' });
  });

  it('no incluye response_format si request.json no está', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await engine.generate({ prompt: 'x' });

    const [, init] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.response_format).toBeUndefined();
  });
});
