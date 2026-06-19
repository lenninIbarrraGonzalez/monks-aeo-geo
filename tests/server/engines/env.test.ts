import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  getGeminiConfig,
  getOpenRouterConfig,
} from '@/server/engines/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getGeminiConfig', () => {
  it('devuelve null si no hay GEMINI_API_KEY', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(getGeminiConfig()).toBeNull();
  });

  it('usa el modelo por defecto cuando hay key', () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc');
    vi.stubEnv('GEMINI_MODEL', '');
    expect(getGeminiConfig()).toEqual({ apiKey: 'abc', model: DEFAULT_GEMINI_MODEL });
  });

  it('respeta el override GEMINI_MODEL y recorta espacios', () => {
    vi.stubEnv('GEMINI_API_KEY', '  abc  ');
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
    expect(getGeminiConfig()).toEqual({ apiKey: 'abc', model: 'gemini-2.5-flash' });
  });
});

describe('getOpenRouterConfig', () => {
  it('devuelve null si no hay OPENROUTER_API_KEY', () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    expect(getOpenRouterConfig()).toBeNull();
  });

  it('usa el modelo :free por defecto cuando hay key', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'xyz');
    vi.stubEnv('OPENROUTER_MODEL', '');
    expect(getOpenRouterConfig()).toEqual({ apiKey: 'xyz', model: DEFAULT_OPENROUTER_MODEL });
  });
});
