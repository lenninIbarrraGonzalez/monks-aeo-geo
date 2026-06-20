import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractJsonText, generateStructured } from '@/server/audit/json';
import { isEngineError } from '@/server/engines';
import { fakeEngine } from './_fakes';

const schema = z.object({ ok: z.boolean(), n: z.number() });

describe('extractJsonText', () => {
  it('devuelve el JSON puro tal cual', () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}');
  });

  it('quita fences ```json y recorta al objeto balanceado', () => {
    const raw = '```json\n{"a": 1, "b": [2, 3]}\n```';
    expect(extractJsonText(raw)).toBe('{"a": 1, "b": [2, 3]}');
  });

  it('recorta prosa alrededor del JSON', () => {
    const raw = 'Claro, aquí tienes: {"a": {"b": 1}} ¡listo!';
    expect(extractJsonText(raw)).toBe('{"a": {"b": 1}}');
  });

  it('ignora llaves dentro de strings', () => {
    const raw = '{"texto": "esto tiene } y { adentro"}';
    expect(extractJsonText(raw)).toBe(raw);
  });

  it('devuelve null si no hay JSON', () => {
    expect(extractJsonText('sin json aquí')).toBeNull();
    expect(extractJsonText('')).toBeNull();
  });
});

describe('generateStructured', () => {
  it('parsea y valida una salida JSON correcta', async () => {
    const engine = fakeEngine(['{"ok": true, "n": 5}']);
    const result = await generateStructured(engine, {
      schema,
      system: 's',
      user: 'u',
    });
    expect(result).toEqual({ ok: true, n: 5 });
  });

  it('reintenta una vez ante salida inválida y luego acepta la válida', async () => {
    const engine = fakeEngine(['no es json', '{"ok": false, "n": 0}']);
    const result = await generateStructured(engine, { schema, system: 's', user: 'u' });
    expect(result).toEqual({ ok: false, n: 0 });
  });

  it('lanza EngineError si tras 2 intentos sigue inválida', async () => {
    const engine = fakeEngine(['nope', 'tampoco']);
    await expect(generateStructured(engine, { schema, system: 's', user: 'u' })).rejects.toSatisfy(
      isEngineError,
    );
  });
});
