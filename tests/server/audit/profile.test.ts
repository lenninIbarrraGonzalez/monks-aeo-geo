import { describe, expect, it } from 'vitest';
import { detectBrandProfile } from '@/server/audit/profile';
import { EngineError } from '@/server/engines';
import type { Engine } from '@/server/engines';
import { fakeEngine, throwingEngine } from './_fakes';

/** Motor cuyo `generate` lanza un EngineError de autenticación. */
function authFailingEngine(): Engine {
  return {
    id: 'gemini',
    label: 'GEMINI',
    model: 'm',
    async generate() {
      throw new EngineError('401', { kind: 'auth', engineId: 'gemini' });
    },
  };
}

describe('detectBrandProfile', () => {
  it('mapea la salida del LLM a un BrandProfile', async () => {
    const engine = fakeEngine([
      JSON.stringify({
        category: 'software de notas',
        description: 'Workspace todo-en-uno.',
        competitors: ['Evernote', ' Obsidian ', ''],
        url: 'https://notion.so',
      }),
    ]);

    const profile = await detectBrandProfile('Notion', engine, 'es');

    expect(profile.name).toBe('Notion');
    expect(profile.category).toBe('software de notas');
    expect(profile.competitors).toEqual(['Evernote', 'Obsidian']);
    expect(profile.url).toBe('https://notion.so');
    expect(profile.detectedBy).toBe('gemini');
    expect(profile.degraded).toBeUndefined();
  });

  it('conserva la URL del input cuando el LLM no la devuelve', async () => {
    const engine = fakeEngine([
      JSON.stringify({ category: 'c', description: 'd', competitors: [] }),
    ]);
    const profile = await detectBrandProfile('https://acme.com', engine, 'es');
    expect(profile.url).toBe('https://acme.com');
  });

  it('degrada con un perfil mínimo si el motor falla (error no-auth)', async () => {
    const profile = await detectBrandProfile('MarcaInventada', throwingEngine('gemini'), 'es');
    expect(profile.degraded).toBe(true);
    expect(profile.competitors).toEqual([]);
    expect(profile.name).toBe('MarcaInventada');
  });

  it('propaga el error de autenticación en vez de degradar (config rota)', async () => {
    await expect(detectBrandProfile('Notion', authFailingEngine(), 'es')).rejects.toMatchObject({
      kind: 'auth',
    });
  });
});
