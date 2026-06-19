import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvailableEngines, getEngine, hasAnyEngine } from '@/server/engines/registry';

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Vacía las keys para partir de un estado sin motores disponibles. */
function clearKeys() {
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('OPENROUTER_API_KEY', '');
}

describe('registry', () => {
  it('sin keys: lista vacía y hasAnyEngine false (degradado elegante)', () => {
    clearKeys();
    expect(getAvailableEngines()).toEqual([]);
    expect(hasAnyEngine()).toBe(false);
    expect(getEngine('gemini')).toBeUndefined();
  });

  it('expone solo los motores con key presente', () => {
    clearKeys();
    vi.stubEnv('GEMINI_API_KEY', 'g');

    const engines = getAvailableEngines();
    expect(engines.map((e) => e.id)).toEqual(['gemini']);
    expect(hasAnyEngine()).toBe(true);
    expect(getEngine('gemini')?.id).toBe('gemini');
    expect(getEngine('openrouter')).toBeUndefined();
  });

  it('expone ambos motores cuando hay ambas keys', () => {
    clearKeys();
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('OPENROUTER_API_KEY', 'o');

    expect(getAvailableEngines().map((e) => e.id)).toEqual(['gemini', 'openrouter']);
  });
});
