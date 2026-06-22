import { describe, expect, it } from 'vitest';
import { judgePrompt, type AnswerToJudge } from '@/server/audit/judge';
import type { AuditPrompt, BrandProfile } from '@/server/audit/types';
import { fakeEngine, throwingEngine } from './_fakes';

const profile: BrandProfile = {
  name: 'Notion',
  category: 'notas',
  description: 'Workspace.',
  competitors: ['Evernote'],
  detectedBy: 'gemini',
};

const prompt: AuditPrompt = {
  id: 'definitional',
  intent: 'definitional',
  text: '¿Qué es Notion?',
  mentionsBrand: true,
};

const answers: AnswerToJudge[] = [
  { engineId: 'gemini', answer: 'Notion es un workspace.' },
  { engineId: 'groq', answer: 'No sé.' },
];

describe('judgePrompt', () => {
  it('mapea las señales por motor y recorta la exactitud en escala 0–100', async () => {
    const judge = fakeEngine([
      JSON.stringify({
        results: [
          {
            engine: 'gemini',
            mentioned: true,
            accuracy: 90,
            sentiment: 'positive',
            competitivePosition: 1,
            citedSource: true,
          },
          {
            engine: 'groq',
            mentioned: false,
            accuracy: 0,
            sentiment: 'neutral',
            competitivePosition: null,
            citedSource: false,
          },
        ],
      }),
    ]);

    const result = await judgePrompt(prompt, answers, profile, [judge], 'es');

    expect(result.get('gemini')).toEqual({
      mentioned: true,
      accuracy: 0.9, // 90 → 0.9
      sentiment: 'positive',
      competitivePosition: 1,
      citedSource: true,
    });
    expect(result.get('groq')?.mentioned).toBe(false);
  });

  it('fuerza señales ausentes cuando el juez dice que no la menciona', async () => {
    const judge = fakeEngine([
      JSON.stringify({
        results: [
          {
            engine: 'gemini',
            mentioned: false,
            accuracy: 80,
            sentiment: 'positive',
            competitivePosition: 3,
            citedSource: true,
          },
        ],
      }),
    ]);
    const result = await judgePrompt(prompt, [answers[0]!], profile, [judge], 'es');
    const g = result.get('gemini')!;
    expect(g.accuracy).toBe(0);
    expect(g.competitivePosition).toBeNull();
  });

  it('asigna señales neutras a un motor que el juez omitió', async () => {
    const judge = fakeEngine([
      JSON.stringify({
        results: [
          {
            engine: 'gemini',
            mentioned: true,
            accuracy: 1,
            sentiment: 'positive',
            competitivePosition: 1,
            citedSource: false,
          },
        ],
      }),
    ]);
    const result = await judgePrompt(prompt, answers, profile, [judge], 'es');
    expect(result.get('groq')).toEqual({
      mentioned: false,
      accuracy: 0,
      sentiment: 'neutral',
      competitivePosition: null,
      citedSource: false,
    });
  });

  it('matchea el id del motor sin distinguir mayúsculas', async () => {
    const judge = fakeEngine([
      JSON.stringify({
        results: [
          {
            engine: 'Gemini',
            mentioned: true,
            accuracy: 1,
            sentiment: 'positive',
            competitivePosition: 1,
            citedSource: true,
          },
        ],
      }),
    ]);
    const result = await judgePrompt(prompt, [answers[0]!], profile, [judge], 'es');
    expect(result.get('gemini')?.mentioned).toBe(true);
  });

  it('propaga el error si el juez falla de forma dura', async () => {
    await expect(
      judgePrompt(prompt, answers, profile, [throwingEngine('gemini')], 'es'),
    ).rejects.toThrow();
  });

  it('sin respuestas devuelve un mapa vacío sin llamar al juez', async () => {
    const result = await judgePrompt(prompt, [], profile, [throwingEngine('gemini')], 'es');
    expect(result.size).toBe(0);
  });

  it('cae al segundo analista cuando el primero falla y avisa cuál cayó', async () => {
    const fallbackJudge = fakeEngine(
      [
        JSON.stringify({
          results: [
            {
              engine: 'gemini',
              mentioned: true,
              accuracy: 1,
              sentiment: 'positive',
              competitivePosition: 1,
              citedSource: true,
            },
          ],
        }),
      ],
      'groq',
    );
    const unavailable: string[] = [];

    const result = await judgePrompt(
      prompt,
      [answers[0]!],
      profile,
      [throwingEngine('gemini'), fallbackJudge],
      'es',
      (id) => unavailable.push(id),
    );

    expect(result.get('gemini')?.mentioned).toBe(true);
    expect(unavailable).toContain('gemini');
  });
});
