import { describe, expect, it } from 'vitest';
import { buildPrompts } from '@/server/audit/prompts';
import type { BrandProfile } from '@/server/audit/types';

const profile: BrandProfile = {
  name: 'Notion',
  category: 'software de notas y productividad',
  description: 'Workspace todo-en-uno para notas, docs y bases de datos.',
  competitors: ['Evernote', 'Obsidian'],
  detectedBy: 'gemini',
};

describe('buildPrompts', () => {
  it('genera las tres intenciones de alto valor', () => {
    const prompts = buildPrompts(profile, 'es');
    const ids = prompts.map((p) => p.id);

    expect(prompts).toHaveLength(3);
    expect(ids).toEqual(['definitional', 'comparative-alternatives', 'categorical']);
    expect(prompts.map((p) => p.intent)).toEqual(['definitional', 'comparative', 'categorical']);
  });

  it('el prompt categórico NO nombra la marca pero sí la categoría', () => {
    const prompts = buildPrompts(profile, 'es');
    const categorical = prompts.find((p) => p.id === 'categorical')!;

    expect(categorical.mentionsBrand).toBe(false);
    expect(categorical.text).not.toContain('Notion');
    expect(categorical.text).toContain(profile.category);
  });

  it('los prompts directos nombran la marca', () => {
    const prompts = buildPrompts(profile, 'es');
    const definitional = prompts.find((p) => p.id === 'definitional')!;
    const alternatives = prompts.find((p) => p.id === 'comparative-alternatives')!;

    expect(definitional.mentionsBrand).toBe(true);
    expect(definitional.text).toContain('Notion');
    expect(alternatives.mentionsBrand).toBe(true);
    expect(alternatives.text).toContain('Notion');
  });

  it('respeta el idioma inglés', () => {
    const definitional = buildPrompts(profile, 'en').find((p) => p.id === 'definitional')!;
    expect(definitional.text).toContain('What is Notion');
  });
});
