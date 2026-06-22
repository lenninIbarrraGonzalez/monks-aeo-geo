import 'server-only';

import type { Engine } from '@/server/engines';
import type { EngineId } from '@/types/engine';
import { generateStructuredWithFallback } from './json';
import { judgeOutputSchema } from './schemas';
import type { AuditPrompt, BrandProfile, JudgeSignals, Locale } from './types';

/**
 * LLM-as-judge: una sola llamada analiza juntas las respuestas de todos los motores a un prompt.
 *
 * Batchear por prompt (no por respuesta) reduce el número de llamadas —clave para no tocar los
 * rate-limits del free tier en vivo— y permite que el juez compare los motores lado a lado.
 * Devuelve señales por motor; ante fallo del juez, señales neutras para que el scoring no rompa.
 */

/** Respuesta de un motor lista para juzgar. */
export interface AnswerToJudge {
  engineId: EngineId;
  answer: string;
}

/** Señales por defecto cuando no hay mención / el juez no opinó sobre un motor. */
export const ABSENT_SIGNALS: JudgeSignals = {
  mentioned: false,
  accuracy: 0,
  sentiment: 'neutral',
  competitivePosition: null,
  citedSource: false,
};

const SYSTEM: Record<Locale, string> = {
  es: 'Sos un evaluador imparcial de visibilidad de marcas en respuestas de IA. Analizás con rigor y respondés SOLO con JSON.',
  en: 'You are an impartial evaluator of brand visibility in AI answers. You analyze rigorously and reply ONLY with JSON.',
};

/** Recorta la exactitud cruda a 0–1 (acepta escala 0–100 dividiéndola). */
function clampAccuracy(raw: number): number {
  const value = raw > 1 ? raw / 100 : raw;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Normaliza el ranking crudo: `<= 0` o ausente → `null`. */
function normalizePosition(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const rounded = Math.round(raw);
  return rounded > 0 ? rounded : null;
}

function buildUser(
  prompt: AuditPrompt,
  answers: AnswerToJudge[],
  profile: BrandProfile,
  locale: Locale,
): string {
  const reference =
    locale === 'en'
      ? [
          `Reference brand profile (ground truth):`,
          `- Name: ${profile.name}`,
          `- Category: ${profile.category}`,
          `- Canonical description: ${profile.description}`,
          `- Known competitors: ${profile.competitors.join(', ') || '(none provided)'}`,
        ].join('\n')
      : [
          `Perfil de referencia de la marca (verdad de base):`,
          `- Nombre: ${profile.name}`,
          `- Categoría: ${profile.category}`,
          `- Descripción canónica: ${profile.description}`,
          `- Competidores conocidos: ${profile.competitors.join(', ') || '(ninguno provisto)'}`,
        ].join('\n');

  const answersBlock = answers
    .map((a) => `<<ENGINE:${a.engineId}>>\n${a.answer || '(sin respuesta)'}`)
    .join('\n\n');

  if (locale === 'en') {
    return [
      reference,
      ``,
      `User question asked to each AI engine:\n"${prompt.text}"`,
      ``,
      `Below are the answers, each tagged with its engine id:`,
      answersBlock,
      ``,
      `For EACH engine, evaluate how the brand "${profile.name}" fares in its answer and return a JSON object:`,
      `{ "results": [ { "engine": "<engine id>", "mentioned": boolean, "accuracy": number 0..1 (factual correctness vs the reference; 0 if not mentioned), "sentiment": "positive"|"neutral"|"negative", "competitivePosition": integer rank where 1 = listed first/best among competitors, or null if not applicable, "citedSource": boolean (does it cite the brand's official site?) } ] }`,
      `Include one entry per engine id shown. Reply ONLY with the JSON.`,
    ].join('\n');
  }

  return [
    reference,
    ``,
    `Pregunta del usuario hecha a cada motor de IA:\n"${prompt.text}"`,
    ``,
    `Abajo están las respuestas, cada una etiquetada con su id de motor:`,
    answersBlock,
    ``,
    `Para CADA motor, evaluá cómo le va a la marca "${profile.name}" en su respuesta y devolvé un objeto JSON:`,
    `{ "results": [ { "engine": "<id de motor>", "mentioned": boolean, "accuracy": número 0..1 (exactitud factual vs la referencia; 0 si no la menciona), "sentiment": "positive"|"neutral"|"negative", "competitivePosition": ranking entero donde 1 = aparece primera/mejor entre competidores, o null si no aplica, "citedSource": boolean (¿cita el sitio oficial de la marca?) } ] }`,
    `Incluí una entrada por cada id de motor mostrado. Respondé SOLO con el JSON.`,
  ].join('\n');
}

/**
 * Juzga las respuestas de todos los motores a un prompt. Devuelve un mapa `engineId → señales`.
 *
 * Los motores que respondieron pero que el juez omitió quedan con {@link ABSENT_SIGNALS}. Se
 * prueban los `analysts` en orden (fallback): si el primero está caído se pasa al siguiente, y
 * `onUnavailable` avisa al orquestador para no reintentar ese analista en prompts posteriores. Si
 * NINGÚN analista logra juzgar, propaga el error: el orquestador marca la celda como fallo para
 * EXCLUIRLA del scoring, en vez de contabilizarla como una ausencia real de la marca.
 */
export async function judgePrompt(
  prompt: AuditPrompt,
  answers: AnswerToJudge[],
  profile: BrandProfile,
  analysts: Engine[],
  locale: Locale,
  onUnavailable?: (engineId: EngineId) => void,
): Promise<Map<EngineId, JudgeSignals>> {
  const result = new Map<EngineId, JudgeSignals>();
  for (const a of answers) result.set(a.engineId, { ...ABSENT_SIGNALS });

  if (answers.length === 0) return result;

  // El juez puede devolver el id con otra capitalización o un alias; matcheamos sin distinguir
  // mayúsculas para no perder silenciosamente las señales de un motor que sí respondió.
  const byLowerId = new Map(answers.map((a) => [a.engineId.toLowerCase(), a.engineId]));

  const { data: output } = await generateStructuredWithFallback(
    analysts,
    {
      schema: judgeOutputSchema,
      system: SYSTEM[locale],
      user: buildUser(prompt, answers, profile, locale),
      temperature: 0,
    },
    onUnavailable,
  );

  for (const entry of output.results) {
    const engineId = byLowerId.get(entry.engine.trim().toLowerCase());
    if (!engineId) continue;
    result.set(engineId, {
      mentioned: entry.mentioned,
      accuracy: entry.mentioned ? clampAccuracy(entry.accuracy) : 0,
      sentiment: entry.sentiment,
      competitivePosition: entry.mentioned ? normalizePosition(entry.competitivePosition) : null,
      citedSource: entry.citedSource,
    });
  }

  return result;
}
