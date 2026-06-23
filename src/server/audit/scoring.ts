/**
 * Scoring determinístico del AI Visibility Score (0–100).
 *
 * Función pura: toma las `runs` ya juzgadas y los `prompts`, y produce el score global, por
 * dimensión y por motor. Sin red ni aleatoriedad → totalmente testeable. Las runs con `error`
 * (motor o juez fallaron en esa celda) se excluyen de los denominadores: una falla de
 * infraestructura nuestra no debe penalizar la visibilidad de la marca.
 */

import type {
  AuditPrompt,
  AuditScore,
  DimensionScores,
  EngineRun,
  EngineScore,
  Sentiment,
} from './types';

/** Pesos de cada dimensión en el score global. Suman 1. */
export const DIMENSION_WEIGHTS: Record<keyof DimensionScores, number> = {
  presence: 0.35,
  accuracy: 0.2,
  sentiment: 0.2,
  competitive: 0.15,
  citation: 0.1,
};

/** Puntaje de sentimiento por categoría. */
const SENTIMENT_SCORE: Record<Sentiment, number> = {
  positive: 100,
  neutral: 60,
  negative: 0,
};

/** Peso de presencia: los prompts sin marca valen el doble (emerger sola es más difícil y valioso). */
const PRESENCE_WEIGHT_WITH_BRAND = 1;
const PRESENCE_WEIGHT_NO_BRAND = 2;

const ZERO_DIMENSIONS: DimensionScores = {
  presence: 0,
  accuracy: 0,
  sentiment: 0,
  competitive: 0,
  citation: 0,
};

/** Redondea a entero, acotando a 0–100. */
function clampRound(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Convierte un ranking competitivo (1 = mejor) a puntaje 0–100. */
function positionScore(position: number): number {
  return Math.max(0, 100 - (position - 1) * 20);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Dimensiones de un conjunto de runs, más si la dimensión competitiva aplica. */
interface ScoredDimensions {
  dimensions: DimensionScores;
  /** `true` si al menos una run tuvo ranking competitivo (si no, se excluye del overall). */
  hasCompetitive: boolean;
}

/** Calcula las cinco dimensiones para un conjunto de runs. */
function computeDimensions(
  runs: EngineRun[],
  mentionsBrand: Map<string, boolean>,
): ScoredDimensions {
  const valid = runs.filter((run) => !run.error);
  if (valid.length === 0) return { dimensions: { ...ZERO_DIMENSIONS }, hasCompetitive: false };

  // Presencia: tasa de mención ponderada (prompts sin marca pesan el doble).
  let weightSum = 0;
  let weightHit = 0;
  for (const run of valid) {
    const noBrand = mentionsBrand.get(run.promptId) === false;
    const weight = noBrand ? PRESENCE_WEIGHT_NO_BRAND : PRESENCE_WEIGHT_WITH_BRAND;
    weightSum += weight;
    if (run.signals.mentioned) weightHit += weight;
  }
  const presence = weightSum > 0 ? (100 * weightHit) / weightSum : 0;

  // Las dimensiones cualitativas (exactitud, sentimiento, citación) solo aplican donde la marca
  // fue mencionada: citar o describir bien algo que no se nombró no tiene sentido.
  const mentioned = valid.filter((run) => run.signals.mentioned);
  const accuracy = average(mentioned.map((run) => run.signals.accuracy * 100));
  const sentiment = average(mentioned.map((run) => SENTIMENT_SCORE[run.signals.sentiment]));
  const citation = average(mentioned.map((run) => (run.signals.citedSource ? 100 : 0)));

  // Predicado de tipo: estrecha `competitivePosition` a `number` sin cast, para que el `map`
  // de abajo no necesite aseverar el tipo a mano.
  const positioned = valid.filter(
    (run): run is EngineRun & { signals: { competitivePosition: number } } =>
      run.signals.competitivePosition !== null,
  );
  const competitive = average(
    positioned.map((run) => positionScore(run.signals.competitivePosition)),
  );

  return {
    dimensions: {
      presence: clampRound(presence),
      accuracy: clampRound(accuracy),
      sentiment: clampRound(sentiment),
      competitive: clampRound(competitive),
      citation: clampRound(citation),
    },
    hasCompetitive: positioned.length > 0,
  };
}

/**
 * Combina las dimensiones en el puntaje global ponderado.
 *
 * Si no hubo dato competitivo (`hasCompetitive` false), esa dimensión se EXCLUYE y los pesos se
 * renormalizan: "nunca comparada" no debe penalizar como "rankeada última". Iterar los pesos
 * (en vez de sumar términos a mano) evita que una sexta dimensión quede fuera del overall.
 */
function overallFrom(dimensions: DimensionScores, hasCompetitive: boolean): number {
  const keys = (Object.keys(DIMENSION_WEIGHTS) as Array<keyof DimensionScores>).filter(
    (key) => key !== 'competitive' || hasCompetitive,
  );
  const weightSum = keys.reduce((sum, key) => sum + DIMENSION_WEIGHTS[key], 0);
  const weighted = keys.reduce((sum, key) => sum + dimensions[key] * DIMENSION_WEIGHTS[key], 0);
  return clampRound(weightSum > 0 ? weighted / weightSum : 0);
}

/**
 * Calcula el {@link AuditScore} completo a partir de las runs juzgadas y los prompts.
 * El desglose `byEngine` aplica las mismas fórmulas restringidas a las runs de cada motor.
 */
export function computeScore(runs: EngineRun[], prompts: AuditPrompt[]): AuditScore {
  const mentionsBrand = new Map(prompts.map((p) => [p.id, p.mentionsBrand]));

  const { dimensions, hasCompetitive } = computeDimensions(runs, mentionsBrand);

  // Agrupar por motor preservando el orden de aparición.
  const byEngineMap = new Map<string, EngineRun[]>();
  for (const run of runs) {
    const list = byEngineMap.get(run.engineId);
    if (list) list.push(run);
    else byEngineMap.set(run.engineId, [run]);
  }

  const byEngine: EngineScore[] = [];
  for (const [, engineRuns] of byEngineMap) {
    const first = engineRuns[0]!;
    const scored = computeDimensions(engineRuns, mentionsBrand);
    byEngine.push({
      engineId: first.engineId,
      label: first.label,
      overall: overallFrom(scored.dimensions, scored.hasCompetitive),
      dimensions: scored.dimensions,
    });
  }

  return {
    overall: overallFrom(dimensions, hasCompetitive),
    dimensions,
    byEngine,
  };
}
