/**
 * Lógica de presentación pura para el dashboard de resultados (Fase 6).
 *
 * Transforma un `AuditResult` en vistas derivadas (recomendaciones, posicionamiento competitivo,
 * citas agrupadas) y expone los helpers de color del score. Todo es determinístico y sin efectos
 * → testeable de forma aislada. Las funciones devuelven datos estructurados (claves/enums), nunca
 * texto: el copy localizado vive en i18n.
 */

import { DIMENSION_WEIGHTS } from '@/server/audit/scoring';
import type {
  AuditPrompt,
  AuditResult,
  AuditScore,
  DimensionScores,
  EngineRun,
} from '@/server/audit/types';

/** Tramos del score, alineados con los cortes de color. */
export type ScoreTier = 'high' | 'mid' | 'low';

/** Orden canónico de las dimensiones para renderizar desgloses. */
export const DIMENSIONS: (keyof DimensionScores)[] = [
  'presence',
  'accuracy',
  'sentiment',
  'competitive',
  'citation',
];

/** Umbral por debajo del cual una dimensión genera una recomendación. */
const RECOMMENDATION_THRESHOLD = 67;

/** Tope de recomendaciones mostradas (las de mayor impacto). */
const MAX_RECOMMENDATIONS = 4;

/** Tramo de un valor 0–100 (mismos cortes que `scoreColor`/`barColor`). */
export function scoreTier(value: number): ScoreTier {
  if (value >= 67) return 'high';
  if (value >= 34) return 'mid';
  return 'low';
}

/** Color del número/score titular según su tramo. */
export function scoreColor(value: number): string {
  if (value >= 67) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 34) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

/** Color de relleno de una barra según su valor. */
export function barColor(value: number): string {
  if (value >= 67) return 'bg-emerald-500';
  if (value >= 34) return 'bg-amber-500';
  return 'bg-destructive';
}

export interface Recommendation {
  dimension: keyof DimensionScores;
  tier: ScoreTier;
}

/**
 * Recomendaciones accionables derivadas de las dimensiones más débiles. Cada dimensión por debajo
 * del umbral genera una recomendación; se ordenan por impacto (peso × brecha contra 100) para que
 * primero aparezca lo que más mueve el score, y se acotan a `MAX_RECOMMENDATIONS`. Si no hay
 * debilidades, devuelve `[]` (el dashboard muestra un mensaje positivo).
 */
export function deriveRecommendations(score: AuditScore): Recommendation[] {
  return DIMENSIONS.filter((dimension) => score.dimensions[dimension] < RECOMMENDATION_THRESHOLD)
    .map((dimension) => {
      const value = score.dimensions[dimension];
      return {
        dimension,
        tier: scoreTier(value),
        impact: (100 - value) * DIMENSION_WEIGHTS[dimension],
      };
    })
    .sort((a, b) => b.impact - a.impact)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ dimension, tier }) => ({ dimension, tier }));
}

export interface CompetitiveView {
  /** Competidores detectados en el perfil de la marca. */
  competitors: string[];
  /** Posiciones observadas (1 = mejor) en las respuestas que sí compararon. */
  positions: number[];
  /** Mejor posición alcanzada (mínimo de `positions`), o `null` si no hubo comparación. */
  bestPosition: number | null;
  /** `true` si alguna respuesta posicionó a la marca frente a competidores. */
  hasData: boolean;
}

/**
 * Posicionamiento competitivo agregado a partir de las señales del juez. Solo cuentan las celdas
 * sin error con `competitivePosition` no nula (las comparativas/recomendación donde aplica).
 */
export function deriveCompetitive(result: AuditResult): CompetitiveView {
  const positions = result.runs
    .filter((run) => !run.error && run.signals.competitivePosition != null)
    .map((run) => run.signals.competitivePosition as number);

  return {
    competitors: result.profile.competitors,
    positions,
    bestPosition: positions.length > 0 ? Math.min(...positions) : null,
    hasData: positions.length > 0,
  };
}

export interface PromptGroup {
  prompt: AuditPrompt;
  runs: EngineRun[];
}

/**
 * Agrupa las `runs` por pregunta, en el orden de `prompts`, para la sección de citas. Incluye las
 * celdas con error o respuesta vacía: se muestran como fallidas, con transparencia total.
 */
export function groupRunsByPrompt(result: AuditResult): PromptGroup[] {
  return result.prompts.map((prompt) => ({
    prompt,
    runs: result.runs.filter((run) => run.promptId === prompt.id),
  }));
}
