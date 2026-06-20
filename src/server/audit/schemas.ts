/**
 * Esquemas Zod de las salidas estructuradas del LLM (detección de perfil y juez).
 *
 * Se mantienen deliberadamente permisivos en los rangos numéricos (no `.min/.max`): los modelos
 * a veces devuelven exactitud en escala 0–100 o rankings en 0. El recorte/normalización a los
 * rangos del dominio se hace al mapear (ver `profile.ts` y `judge.ts`), para no descartar una
 * respuesta entera por un número fuera de rango.
 */

import { z } from 'zod';

/** Salida cruda de la detección de perfil. */
export const profileOutputSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  competitors: z.array(z.string()).default([]),
  url: z.string().nullish(),
});

export type ProfileOutput = z.infer<typeof profileOutputSchema>;

/** Sentimiento aceptado del juez. */
export const sentimentSchema = z.enum(['positive', 'neutral', 'negative']);

/** Señales que el juez reporta para la respuesta de UN motor. */
export const engineJudgmentSchema = z.object({
  /** Token del motor que el juez recibió (coincide con el `engineId`). */
  engine: z.string(),
  mentioned: z.boolean(),
  /** Exactitud cruda; se recorta a 0–1 al mapear. */
  accuracy: z.number(),
  sentiment: sentimentSchema,
  /** Ranking crudo; `<= 0` se trata como `null` al mapear. */
  competitivePosition: z.number().nullish(),
  citedSource: z.boolean(),
});

export type EngineJudgment = z.infer<typeof engineJudgmentSchema>;

/** Salida del juez para un prompt: una entrada por motor evaluado. */
export const judgeOutputSchema = z.object({
  results: z.array(engineJudgmentSchema),
});

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;
