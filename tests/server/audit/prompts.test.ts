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
  it('genera las 5 intenciones (más vs cuando hay competidor)', () => {
    const prompts = buildPrompts(profile, 'es');
    const intents = prompts.map((p) => p.intent);

    expect(intents).toContain('definitional');
    expect(intents).toContain('evaluative');
    expect(intents).toContain('comparative');
    expect(intents).toContain('categorical');
    expect(intents).toContain('recommendation');
    // alternatives + vs = 2 comparativos
    expect(intents.filter((i) => i === 'comparative')).toHaveLength(2);
  });

  it('los prompts categórico y de recomendación NO nombran la marca', () => {
    const prompts = buildPrompts(profile, 'es');
    const categorical = prompts.find((p) => p.id === 'categorical')!;
    const recommendation = prompts.find((p) => p.id === 'recommendation')!;

    expect(categorical.mentionsBrand).toBe(false);
    expect(recommendation.mentionsBrand).toBe(false);
    expect(categorical.text).not.toContain('Notion');
    expect(recommendation.text).not.toContain('Notion');
    expect(categorical.text).toContain(profile.category);
  });

  it('interpola marca y competidor en el prompt comparativo vs', () => {
    const vs = buildPrompts(profile, 'es').find((p) => p.id === 'comparative-vs')!;
    expect(vs.text).toContain('Notion');
    expect(vs.text).toContain('Evernote');
  });

  it('omite el prompt vs si no hay competidores', () => {
    const ids = buildPrompts({ ...profile, competitors: [] }, 'es').map((p) => p.id);
    expect(ids).not.toContain('comparative-vs');
  });

  it('respeta el idioma inglés', () => {
    const definitional = buildPrompts(profile, 'en').find((p) => p.id === 'definitional')!;
    expect(definitional.text).toContain('What is Notion');
  });
});
