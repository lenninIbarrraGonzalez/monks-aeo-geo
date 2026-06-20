import 'server-only';

import type { Engine } from '@/server/engines';
import { EngineError, getAvailableEngines } from '@/server/engines';
import type { EngineId } from '@/types/engine';
import { ABSENT_SIGNALS, judgePrompt, type AnswerToJudge } from './judge';
import { detectBrandProfile } from './profile';
import { buildPrompts } from './prompts';
import { computeScore } from './scoring';
import type {
  AuditPrompt,
  AuditResult,
  EngineInfo,
  EngineRun,
  JudgeSignals,
  Locale,
  ProgressHandler,
} from './types';

/**
 * Orquestador de la auditoría: el punto de entrada del motor (Fase 3).
 *
 * Secuencia: detección de perfil → generación de prompts → ejecución multi-motor → juez por
 * prompt → scoring. Emite progreso por `onProgress` en cada hito para que la Fase 4 lo envuelva
 * en SSE sin tocar este núcleo. Degrada con elegancia: un motor que falla en un prompt registra
 * el error en su celda y la auditoría continúa con el resto.
 */

export interface RunAuditOptions {
  /** Idioma del reporte (default `es`). */
  locale?: Locale;
  /** Motores de ejecución; por defecto todos los disponibles en el entorno. */
  engines?: Engine[];
  /** Motor analista para perfil y juez; por defecto Gemini si está, si no el primero. */
  analyst?: Engine;
  /** Tope de tokens por respuesta de motor (default 800). */
  maxTokens?: number;
  /** Callback de progreso (puede ser async). */
  onProgress?: ProgressHandler;
  /** Señal de cancelación propagada a todas las llamadas. */
  signal?: AbortSignal;
}

const DEFAULT_MAX_TOKENS = 800;

/** Elige el motor analista: prefiere Gemini (estable para análisis), si no el primero. */
function pickAnalyst(engines: Engine[]): Engine {
  return engines.find((e) => e.id === 'gemini') ?? engines[0]!;
}

/**
 * Corre una auditoría completa para `input` (nombre de marca o URL).
 * @throws {EngineError} si no hay ningún motor disponible.
 */
export async function runAudit(input: string, options: RunAuditOptions = {}): Promise<AuditResult> {
  const {
    locale = 'es',
    engines = getAvailableEngines(),
    maxTokens = DEFAULT_MAX_TOKENS,
    onProgress,
    signal,
  } = options;

  if (engines.length === 0) {
    throw new EngineError('No hay motores de IA configurados', { kind: 'auth' });
  }
  const analyst = options.analyst ?? pickAnalyst(engines);

  const emit: ProgressHandler = async (event) => {
    if (onProgress) await onProgress(event);
  };

  // 1. Perfil de referencia.
  const profile = await detectBrandProfile(input, analyst, locale);
  await emit({ type: 'profile', profile });

  // 2. Prompts (las 5 intenciones).
  const prompts = buildPrompts(profile, locale);
  await emit({ type: 'prompts', prompts });

  // 3–4. Por cada prompt: ejecución multi-motor en paralelo + juez batcheado.
  const runs: EngineRun[] = [];

  for (const prompt of prompts) {
    const settled = await Promise.all(
      engines.map(async (engine) => {
        try {
          const response = await engine.generate({
            prompt: prompt.text,
            maxTokens,
            ...(signal && { signal }),
          });
          await emit({ type: 'answer', promptId: prompt.id, engineId: engine.id, ok: true });
          return { engine, answer: response.text, model: response.model, error: undefined };
        } catch (cause) {
          await emit({ type: 'answer', promptId: prompt.id, engineId: engine.id, ok: false });
          const message = cause instanceof Error ? cause.message : 'fallo del motor';
          return { engine, answer: '', model: engine.model, error: message };
        }
      }),
    );

    // Solo se juzgan los motores que respondieron.
    const toJudge: AnswerToJudge[] = settled
      .filter((s) => !s.error)
      .map((s) => ({ engineId: s.engine.id, answer: s.answer }));

    // Si el juez falla de forma dura, las celdas que SÍ respondieron se marcan como error para
    // excluirlas del scoring: un fallo de análisis nuestro no debe contar como marca ausente.
    let signalsByEngine: Map<EngineId, JudgeSignals> = new Map();
    let judgeError: string | undefined;
    try {
      signalsByEngine = await judgePrompt(prompt, toJudge, profile, analyst, locale);
    } catch (cause) {
      judgeError = cause instanceof Error ? `juez: ${cause.message}` : 'fallo del juez';
    }
    await emit({ type: 'judged', promptId: prompt.id });

    for (const s of settled) {
      const cellError = s.error ?? judgeError;
      const signals = cellError
        ? { ...ABSENT_SIGNALS }
        : (signalsByEngine.get(s.engine.id) ?? { ...ABSENT_SIGNALS });
      runs.push({
        promptId: prompt.id,
        intent: prompt.intent,
        engineId: s.engine.id,
        label: s.engine.label,
        model: s.model,
        answer: s.answer,
        signals,
        ...(cellError && { error: cellError }),
      });
    }
  }

  // 5. Scoring.
  const score = computeScore(runs, prompts);
  await emit({ type: 'scored', score });

  const enginesUsed: EngineInfo[] = engines.map((e) => ({
    id: e.id,
    label: e.label,
    model: e.model,
  }));

  return {
    profile,
    prompts,
    runs,
    score,
    enginesUsed,
    locale,
    createdAt: new Date().toISOString(),
  };
}

export type { AuditPrompt };
