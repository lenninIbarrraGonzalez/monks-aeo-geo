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
  /**
   * Analistas para perfil y juez, en orden de preferencia (fallback). Por defecto Gemini primero
   * (si está) y el resto detrás: si el preferido cae, la auditoría sigue con el siguiente.
   */
  analysts?: Engine[];
  /** Tope de tokens por respuesta de motor (default 400). */
  maxTokens?: number;
  /** Callback de progreso (puede ser async). */
  onProgress?: ProgressHandler;
  /** Señal de cancelación propagada a todas las llamadas. */
  signal?: AbortSignal;
}

const DEFAULT_MAX_TOKENS = 400;

/**
 * Tope de tokens para las llamadas a los analistas (perfil y juez). Su salida es JSON acotado
 * (un objeto de perfil; un array con una entrada por motor), así que un cap holgado evita costo y
 * latencia imprevisibles sin riesgo de truncar la respuesta.
 */
const ANALYST_MAX_TOKENS = 1024;

/**
 * Ordena los analistas por preferencia: Gemini primero (estable para análisis) y el resto detrás.
 * El orden define la cadena de fallback para perfil y juez.
 */
function pickAnalysts(engines: Engine[]): Engine[] {
  const gemini = engines.find((e) => e.id === 'gemini');
  return gemini ? [gemini, ...engines.filter((e) => e !== gemini)] : [...engines];
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
  const analysts = options.analysts ?? pickAnalysts(engines);

  // Un analista que cae (sin cuota, auth, timeout) se marca y se descarta del resto de la
  // auditoría: así Gemini sin cuota se intenta UNA vez (perfil) en vez de una por cada prompt del
  // juez — la diferencia entre entrar o no en el `maxDuration` de Vercel cuando el preferido muere.
  const deadAnalysts = new Set<EngineId>();
  const markAnalystUnavailable = (id: EngineId): void => {
    deadAnalysts.add(id);
  };
  const liveAnalysts = (): Engine[] => {
    const live = analysts.filter((e) => !deadAnalysts.has(e.id));
    // Si todos quedaron marcados, igual reintentamos con la cadena completa (último recurso).
    return live.length > 0 ? live : analysts;
  };

  const emit: ProgressHandler = async (event) => {
    if (onProgress) await onProgress(event);
  };

  // Opciones comunes de las llamadas a analistas: propagan la cancelación del cliente y acotan la
  // salida. Sin esto, perfil/juez seguirían corriendo (y quemando cuota) tras un abort.
  const analystOptions = { maxTokens: ANALYST_MAX_TOKENS, ...(signal && { signal }) };

  // 1. Perfil de referencia.
  const profile = await detectBrandProfile(
    input,
    liveAnalysts(),
    locale,
    markAnalystUnavailable,
    analystOptions,
  );
  await emit({ type: 'profile', profile });

  // 2. Prompts (las tres intenciones de alto valor).
  const prompts = buildPrompts(profile, locale);
  await emit({ type: 'prompts', prompts });

  // 3–4. Por cada prompt: ejecución multi-motor en paralelo + juez batcheado.
  //
  // Los prompts son independientes entre sí (no comparten datos), así que se procesan TODOS en
  // paralelo en vez de uno por uno: la fase pesada pasa de `3 × (motor + juez)` a `1 × (motor +
  // juez)`. El frontend indexa el progreso por `promptId`/`engineId`, así que el orden de llegada
  // de los eventos no importa. `runs` conserva el orden de prompts porque `map` preserva el índice.
  const processPrompt = async (prompt: AuditPrompt): Promise<EngineRun[]> => {
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
      signalsByEngine = await judgePrompt(
        prompt,
        toJudge,
        profile,
        liveAnalysts(),
        locale,
        markAnalystUnavailable,
        analystOptions,
      );
    } catch (cause) {
      judgeError = cause instanceof Error ? `juez: ${cause.message}` : 'fallo del juez';
    }
    await emit({ type: 'judged', promptId: prompt.id });

    return settled.map((s) => {
      const cellError = s.error ?? judgeError;
      const signals = cellError
        ? { ...ABSENT_SIGNALS }
        : (signalsByEngine.get(s.engine.id) ?? { ...ABSENT_SIGNALS });
      return {
        promptId: prompt.id,
        intent: prompt.intent,
        engineId: s.engine.id,
        label: s.engine.label,
        model: s.model,
        answer: s.answer,
        signals,
        ...(cellError && { error: cellError }),
      };
    });
  };

  const runsByPrompt = await Promise.all(prompts.map(processPrompt));
  const runs: EngineRun[] = runsByPrompt.flat();

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
