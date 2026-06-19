import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeminiEngine } from '@/server/engines/gemini';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const engine = createGeminiEngine({ apiKey: 'k', model: 'gemini-2.0-flash' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createGeminiEngine', () => {
  it('expone id, model y label legible', () => {
    expect(engine.id).toBe('gemini');
    expect(engine.model).toBe('gemini-2.0-flash');
    expect(engine.label).toBe('Gemini 2.0 Flash');
  });

  it('mapea una respuesta OK a EngineResponse normalizada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        candidates: [
          { content: { parts: [{ text: 'Hola ' }, { text: 'mundo' }] }, finishReason: 'STOP' },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await engine.generate({ prompt: '¿Qué es X?' });

    expect(result.engineId).toBe('gemini');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.text).toBe('Hola mundo');
    expect(result.finishReason).toBe('STOP');
    expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 3, totalTokens: 8 });

    // El prompt se envía como contents con rol user y la key va por header.
    const [, init] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.contents[0]).toEqual({ role: 'user', parts: [{ text: '¿Qué es X?' }] });
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'k' });
  });

  it('manda los mensajes system como systemInstruction', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await engine.generate({
      messages: [
        { role: 'system', content: 'Sé conciso' },
        { role: 'user', content: 'Hola' },
      ],
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.systemInstruction).toEqual({ parts: [{ text: 'Sé conciso' }] });
    expect(sentBody.contents).toHaveLength(1);
  });

  it('propaga 401 como EngineError kind auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'no key' }, 401)));
    await expect(engine.generate({ prompt: 'x' })).rejects.toMatchObject({ kind: 'auth' });
  });

  it('lanza invalid_response si no hay candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
    await expect(engine.generate({ prompt: 'x' })).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
