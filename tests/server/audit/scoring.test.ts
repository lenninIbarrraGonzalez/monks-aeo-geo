import { describe, expect, it } from 'vitest';
import { computeScore } from '@/server/audit/scoring';
import type { AuditPrompt, EngineRun, JudgeSignals } from '@/server/audit/types';

const PERFECT: JudgeSignals = {
  mentioned: true,
  accuracy: 1,
  sentiment: 'positive',
  competitivePosition: 1,
  citedSource: true,
};

function run(overrides: Partial<EngineRun> = {}): EngineRun {
  return {
    promptId: 'definitional',
    intent: 'definitional',
    engineId: 'gemini',
    label: 'Gemini',
    model: 'm',
    answer: 'respuesta',
    signals: { ...PERFECT },
    ...overrides,
  };
}

const prompt = (id: string, mentionsBrand: boolean): AuditPrompt => ({
  id,
  intent: 'definitional',
  text: 't',
  mentionsBrand,
});

describe('computeScore', () => {
  it('todo perfecto → 100 en cada dimensión y overall', () => {
    const prompts = [prompt('definitional', true)];
    const score = computeScore([run()], prompts);

    expect(score.overall).toBe(100);
    expect(score.dimensions).toEqual({
      presence: 100,
      accuracy: 100,
      sentiment: 100,
      competitive: 100,
      citation: 100,
    });
  });

  it('marca nunca mencionada → 0 en todo', () => {
    const prompts = [prompt('definitional', true)];
    const absent: JudgeSignals = {
      mentioned: false,
      accuracy: 0,
      sentiment: 'neutral',
      competitivePosition: null,
      citedSource: false,
    };
    const score = computeScore([run({ signals: absent })], prompts);

    expect(score.overall).toBe(0);
    expect(score.dimensions).toEqual({
      presence: 0,
      accuracy: 0,
      sentiment: 0,
      competitive: 0,
      citation: 0,
    });
  });

  it('los prompts sin marca pesan el doble en presencia', () => {
    const prompts = [prompt('with', true), prompt('without', false)];
    const runs = [
      run({ promptId: 'with', signals: { ...PERFECT, mentioned: false } }),
      run({ promptId: 'without', signals: { ...PERFECT, mentioned: true } }),
    ];
    // peso: with=1 (no mencionado), without=2 (mencionado) → 100*2/3 = 66.67 → 67
    expect(computeScore(runs, prompts).dimensions.presence).toBe(67);
  });

  it('excluye las runs con error de los denominadores', () => {
    const prompts = [prompt('definitional', true)];
    const runs = [
      run({ engineId: 'gemini', signals: { ...PERFECT } }),
      run({
        engineId: 'groq',
        error: 'timeout',
        answer: '',
        signals: { ...PERFECT, mentioned: false, accuracy: 0 },
      }),
    ];
    const score = computeScore(runs, prompts);
    // La celda con error no arrastra la presencia: queda 100 por la run válida.
    expect(score.dimensions.presence).toBe(100);
  });

  it('mapea la posición competitiva a puntaje (1→100, 2→80, 6→0)', () => {
    const prompts = [prompt('definitional', true)];
    const mk = (pos: number) => run({ signals: { ...PERFECT, competitivePosition: pos } });

    expect(computeScore([mk(1)], prompts).dimensions.competitive).toBe(100);
    expect(computeScore([mk(2)], prompts).dimensions.competitive).toBe(80);
    expect(computeScore([mk(6)], prompts).dimensions.competitive).toBe(0);
  });

  it('sentimiento negativo puntúa 0 y neutro 60 (donde hay mención)', () => {
    const prompts = [prompt('definitional', true)];
    const neg = run({ signals: { ...PERFECT, sentiment: 'negative' } });
    const neu = run({ signals: { ...PERFECT, sentiment: 'neutral' } });

    expect(computeScore([neg], prompts).dimensions.sentiment).toBe(0);
    expect(computeScore([neu], prompts).dimensions.sentiment).toBe(60);
  });

  it('desglosa el score por motor', () => {
    const prompts = [prompt('definitional', true)];
    const runs = [
      run({ engineId: 'gemini', label: 'Gemini' }),
      run({
        engineId: 'groq',
        label: 'Groq',
        signals: {
          ...PERFECT,
          mentioned: false,
          accuracy: 0,
          sentiment: 'neutral',
          competitivePosition: null,
          citedSource: false,
        },
      }),
    ];
    const score = computeScore(runs, prompts);

    expect(score.byEngine).toHaveLength(2);
    const gemini = score.byEngine.find((e) => e.engineId === 'gemini');
    const groq = score.byEngine.find((e) => e.engineId === 'groq');
    expect(gemini?.overall).toBe(100);
    expect(groq?.overall).toBe(0);
  });

  it('sin runs → score 0 y sin desgloses por motor', () => {
    const score = computeScore([], []);
    expect(score.overall).toBe(0);
    expect(score.byEngine).toEqual([]);
  });

  it('no penaliza la dimensión competitiva cuando nunca hubo comparación', () => {
    const prompts = [prompt('definitional', true)];
    // Marca mencionada, exacta, positiva y citada, pero sin ranking competitivo.
    const noRank = run({ signals: { ...PERFECT, competitivePosition: null } });
    const score = computeScore([noRank], prompts);

    // competitive=0 (no aplica) pero NO arrastra el overall: se renormalizan los pesos.
    expect(score.dimensions.competitive).toBe(0);
    expect(score.overall).toBe(100);
  });

  it('la citación se mide solo sobre las respuestas que mencionan la marca', () => {
    const prompts = [prompt('a', true), prompt('b', false)];
    const runs = [
      run({ promptId: 'a', signals: { ...PERFECT, mentioned: true, citedSource: true } }),
      run({
        promptId: 'b',
        signals: {
          mentioned: false,
          accuracy: 0,
          sentiment: 'neutral',
          competitivePosition: null,
          citedSource: false,
        },
      }),
    ];
    // 1 de 1 mención cita la fuente → 100, sin diluir por la run sin mención.
    expect(computeScore(runs, prompts).dimensions.citation).toBe(100);
  });
});
