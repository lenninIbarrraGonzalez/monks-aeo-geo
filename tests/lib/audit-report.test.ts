import { describe, expect, it } from 'vitest';

import {
  barColor,
  deriveCompetitive,
  deriveRecommendations,
  groupRunsByPrompt,
  scoreColor,
  scoreTier,
  type Recommendation,
} from '@/lib/audit-report';
import { DIMENSION_WEIGHTS } from '@/server/audit/scoring';
import type {
  AuditPrompt,
  AuditResult,
  AuditScore,
  DimensionScores,
  EngineRun,
  JudgeSignals,
} from '@/server/audit/types';

/** Señales neutras de base; los tests sobrescriben solo lo que les importa. */
const BASE_SIGNALS: JudgeSignals = {
  mentioned: true,
  accuracy: 0.8,
  sentiment: 'neutral',
  competitivePosition: null,
  citedSource: false,
};

/** Construye una `EngineRun` mínima con overrides. */
function run(overrides: Partial<EngineRun> = {}): EngineRun {
  return {
    promptId: 'definitional',
    intent: 'definitional',
    engineId: 'gemini',
    label: 'Gemini',
    model: 'gemini-2.5-flash',
    answer: 'respuesta',
    signals: { ...BASE_SIGNALS, ...(overrides.signals ?? {}) },
    ...overrides,
  };
}

/** Construye un `AuditScore` a partir de un desglose por dimensión. */
function scoreWith(dimensions: DimensionScores): AuditScore {
  return { overall: 0, dimensions, byEngine: [] };
}

/** Construye un `AuditResult` mínimo con overrides. */
function result(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    profile: {
      name: 'Notion',
      category: 'software de notas y productividad',
      description: 'App de notas, docs y bases de datos.',
      competitors: ['Evernote', 'Obsidian'],
      detectedBy: 'gemini',
    },
    prompts: [],
    runs: [],
    score: scoreWith({ presence: 0, accuracy: 0, sentiment: 0, competitive: 0, citation: 0 }),
    enginesUsed: [{ id: 'gemini', label: 'Gemini', model: 'gemini-2.5-flash' }],
    locale: 'es',
    createdAt: '2026-06-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('scoreTier / scoreColor / barColor', () => {
  it('usa los cortes en los bordes exactos (34 y 67)', () => {
    expect(scoreTier(33)).toBe('low');
    expect(scoreTier(34)).toBe('mid');
    expect(scoreTier(66)).toBe('mid');
    expect(scoreTier(67)).toBe('high');
    expect(scoreTier(0)).toBe('low');
    expect(scoreTier(100)).toBe('high');
  });

  it('scoreColor y barColor comparten los mismos cortes que scoreTier', () => {
    // high
    expect(scoreColor(67)).toContain('emerald');
    expect(barColor(67)).toContain('emerald');
    // mid
    expect(scoreColor(34)).toContain('amber');
    expect(barColor(34)).toContain('amber');
    // low
    expect(scoreColor(33)).toContain('destructive');
    expect(barColor(33)).toContain('destructive');
  });
});

describe('deriveRecommendations', () => {
  it('solo genera recomendaciones para dimensiones por debajo del umbral (67)', () => {
    const score = scoreWith({
      presence: 90,
      accuracy: 66, // bajo → recomendar
      sentiment: 67, // en el umbral → NO recomendar
      competitive: 80,
      citation: 80,
    });
    const recs = deriveRecommendations(score);
    expect(recs.map((r) => r.dimension)).toEqual(['accuracy']);
  });

  it('ordena por impacto (peso × brecha), no por valor crudo', () => {
    // citation=30 → impacto (100-30)*0.10 = 7.0
    // competitive=50 → impacto (100-50)*0.15 = 7.5  → mayor pese a mejor valor crudo
    expect(DIMENSION_WEIGHTS.competitive).toBeGreaterThan(DIMENSION_WEIGHTS.citation);
    const score = scoreWith({
      presence: 90,
      accuracy: 90,
      sentiment: 90,
      competitive: 50,
      citation: 30,
    });
    const recs = deriveRecommendations(score);
    expect(recs.map((r) => r.dimension)).toEqual(['competitive', 'citation']);
  });

  it('acota a 4 recomendaciones cuando las 5 dimensiones están bajas', () => {
    const score = scoreWith({
      presence: 10,
      accuracy: 10,
      sentiment: 10,
      competitive: 10,
      citation: 10,
    });
    const recs = deriveRecommendations(score);
    expect(recs).toHaveLength(4);
    // Con valores iguales, ganan las de mayor peso; citation (0.10, la menor) queda fuera.
    expect(recs.map((r) => r.dimension)).not.toContain('citation');
  });

  it('devuelve [] cuando todas las dimensiones están en o sobre el umbral', () => {
    const score = scoreWith({
      presence: 67,
      accuracy: 80,
      sentiment: 90,
      competitive: 100,
      citation: 67,
    });
    expect(deriveRecommendations(score)).toEqual([]);
  });

  it('asigna el tier correcto a cada recomendación', () => {
    const score = scoreWith({
      presence: 90,
      accuracy: 40, // mid
      sentiment: 90,
      competitive: 90,
      citation: 20, // low
    });
    const byDim = Object.fromEntries(
      deriveRecommendations(score).map((r: Recommendation) => [r.dimension, r.tier]),
    );
    expect(byDim.accuracy).toBe('mid');
    expect(byDim.citation).toBe('low');
  });
});

describe('deriveCompetitive', () => {
  it('ignora celdas con error y celdas sin posición competitiva', () => {
    const res = result({
      runs: [
        run({ signals: { ...BASE_SIGNALS, competitivePosition: 2 } }),
        run({ signals: { ...BASE_SIGNALS, competitivePosition: null } }),
        run({ error: 'boom', signals: { ...BASE_SIGNALS, competitivePosition: 1 } }),
        run({ signals: { ...BASE_SIGNALS, competitivePosition: 3 } }),
      ],
    });
    const view = deriveCompetitive(res);
    expect(view.positions).toEqual([2, 3]);
    expect(view.bestPosition).toBe(2);
    expect(view.hasData).toBe(true);
  });

  it('sin datos competitivos: bestPosition null y hasData false', () => {
    const res = result({
      runs: [run({ signals: { ...BASE_SIGNALS, competitivePosition: null } })],
    });
    const view = deriveCompetitive(res);
    expect(view.positions).toEqual([]);
    expect(view.bestPosition).toBeNull();
    expect(view.hasData).toBe(false);
  });

  it('propaga los competidores del perfil', () => {
    expect(deriveCompetitive(result()).competitors).toEqual(['Evernote', 'Obsidian']);
  });
});

describe('groupRunsByPrompt', () => {
  const prompts: AuditPrompt[] = [
    { id: 'definitional', intent: 'definitional', text: '¿Qué es Notion?', mentionsBrand: true },
    { id: 'categorical', intent: 'categorical', text: 'Mejores apps de notas', mentionsBrand: false },
  ];

  it('agrupa las runs por pregunta preservando el orden de prompts', () => {
    const res = result({
      prompts,
      runs: [
        run({ promptId: 'categorical', engineId: 'groq' }),
        run({ promptId: 'definitional', engineId: 'gemini' }),
      ],
    });
    const groups = groupRunsByPrompt(res);
    expect(groups.map((g) => g.prompt.id)).toEqual(['definitional', 'categorical']);
    expect(groups[0]!.runs).toHaveLength(1);
    expect(groups[0]!.runs[0]!.engineId).toBe('gemini');
  });

  it('incluye celdas con error o respuesta vacía (transparencia total)', () => {
    const res = result({
      prompts: [prompts[0]!],
      runs: [run({ promptId: 'definitional', answer: '', error: 'rate limit' })],
    });
    const [group] = groupRunsByPrompt(res);
    expect(group!.runs).toHaveLength(1);
    expect(group!.runs[0]!.error).toBe('rate limit');
  });

  it('un prompt sin runs produce un grupo con runs vacías', () => {
    const res = result({ prompts: [prompts[0]!], runs: [] });
    expect(groupRunsByPrompt(res)[0]!.runs).toEqual([]);
  });
});
