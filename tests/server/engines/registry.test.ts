import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvailableEngines, getEngine, hasAnyEngine } from '@/server/engines/registry';

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Vacía las keys para partir de un estado sin motores disponibles. */
function clearKeys() {
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GROQ_API_KEY', '');
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

  it('expone los motores en orden de preferencia (gemini, groq, openrouter)', () => {
    clearKeys();
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('GROQ_API_KEY', 'gq');
    vi.stubEnv('OPENROUTER_API_KEY', 'o');

    expect(getAvailableEngines().map((e) => e.id)).toEqual(['gemini', 'groq', 'openrouter']);
  });

  it('expone Groq cuando solo está su key', () => {
    clearKeys();
    vi.stubEnv('GROQ_API_KEY', 'gq');

    expect(getAvailableEngines().map((e) => e.id)).toEqual(['groq']);
    expect(getEngine('groq')?.id).toBe('groq');
  });
});
