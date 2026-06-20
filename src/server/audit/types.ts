/**
 * Tipos de dominio del motor de auditoría AEO/GEO.
 *
 * La auditoría toma una marca, le pregunta a cada motor de IA disponible como lo haría un
 * cliente real, usa un LLM-as-judge para analizar cada respuesta y calcula un AI Visibility
 * Score 0–100 con desgloses por dimensión y por motor. Estos tipos son el contrato entre el
 * orquestador (`runAudit`) y las capas de UI/API (Fases 4–6).
 */

import type { EngineId } from '@/types/engine';

/** Idiomas soportados por el reporte (sigue al selector de la UI). */
export type Locale = 'es' | 'en';

/**
 * Las cinco intenciones de búsqueda que un cliente real le plantearía a una IA.
 * `categorical` es la única que NO nombra la marca: mide si emerge sola en su categoría.
 */
export type PromptIntent =
  | 'definitional'
  | 'evaluative'
  | 'comparative'
  | 'categorical'
  | 'recommendation';

/** Perfil canónico de la marca, auto-detectado por IA. Sirve de referencia para medir exactitud. */
export interface BrandProfile {
  /** Nombre de la marca tal como se audita. */
  name: string;
  /** URL del sitio oficial, si se proveyó o se detectó. */
  url?: string;
  /** Categoría/industria (p. ej. "software de notas y productividad"). */
  category: string;
  /** Descripción canónica corta contra la que se compara la exactitud de las IAs. */
  description: string;
  /** Principales competidores detectados. */
  competitors: string[];
  /** Motor que produjo este perfil (honestidad: nunca atribuir a otro). */
  detectedBy: EngineId;
  /** `true` si el perfil es un fallback mínimo porque la detección falló. */
  degraded?: boolean;
}

/** Pregunta concreta que se le hace a cada motor. */
export interface AuditPrompt {
  /** Id estable (`<intent>` o `<intent>-<n>`). */
  id: string;
  intent: PromptIntent;
  /** Texto de la pregunta en el idioma de la auditoría. */
  text: string;
  /** `false` solo en prompts categóricos: la marca no se nombra a propósito. */
  mentionsBrand: boolean;
}

/** Sentimiento normalizado de una respuesta hacia la marca. */
export type Sentiment = 'positive' | 'neutral' | 'negative';

/** Señales estructuradas que el juez extrae de una respuesta (las 5 dimensiones). */
export interface JudgeSignals {
  /** ¿La respuesta menciona la marca? */
  mentioned: boolean;
  /** Exactitud de lo dicho vs el perfil real, 0–1. `0` si no la menciona. */
  accuracy: number;
  /** Tono hacia la marca. `neutral` si no la menciona. */
  sentiment: Sentiment;
  /**
   * Posición de la marca frente a competidores: 1 = la primera/mejor posicionada.
   * `null` si no aplica (no la menciona o no hay comparación). */
  competitivePosition: number | null;
  /** ¿Cita el sitio/fuente oficial de la marca? */
  citedSource: boolean;
}

/** Resultado de una celda (prompt × motor): la respuesta y su análisis. */
export interface EngineRun {
  promptId: string;
  intent: PromptIntent;
  engineId: EngineId;
  /** Nombre legible del motor (p. ej. "Gemini 2.5 Flash"). */
  label: string;
  /** Modelo exacto que respondió. */
  model: string;
  /** Texto generado por el motor (vacío si el motor falló). */
  answer: string;
  /** Señales del juez para esta respuesta. */
  signals: JudgeSignals;
  /** Mensaje de error si el motor o el juez fallaron en esta celda. */
  error?: string;
}

/** Las cinco dimensiones del score, cada una 0–100. */
export interface DimensionScores {
  presence: number;
  accuracy: number;
  sentiment: number;
  competitive: number;
  citation: number;
}

/** Score 0–100 de un motor concreto, con su desglose por dimensión. */
export interface EngineScore {
  engineId: EngineId;
  label: string;
  overall: number;
  dimensions: DimensionScores;
}

/** AI Visibility Score completo: global, por dimensión y por motor. */
export interface AuditScore {
  /** Nota titular 0–100. */
  overall: number;
  dimensions: DimensionScores;
  byEngine: EngineScore[];
}

/** Motor que participó de la auditoría. */
export interface EngineInfo {
  id: EngineId;
  label: string;
  model: string;
}

/** Resultado completo de una auditoría: lo que consume la UI. */
export interface AuditResult {
  profile: BrandProfile;
  prompts: AuditPrompt[];
  runs: EngineRun[];
  score: AuditScore;
  enginesUsed: EngineInfo[];
  locale: Locale;
  /** ISO timestamp de creación. */
  createdAt: string;
}

/**
 * Eventos de progreso que el orquestador emite por `onProgress`.
 *
 * La Fase 4 los reenvía por SSE sin tocar el núcleo. El orden típico es:
 * `profile` → `prompts` → (`answer` × N) → (`judged` × prompts) → `scored`.
 */
export type AuditProgress =
  | { type: 'profile'; profile: BrandProfile }
  | { type: 'prompts'; prompts: AuditPrompt[] }
  | { type: 'answer'; promptId: string; engineId: EngineId; ok: boolean }
  | { type: 'judged'; promptId: string }
  | { type: 'scored'; score: AuditScore };

/** Callback de progreso. Puede ser async; el orquestador lo espera. */
export type ProgressHandler = (event: AuditProgress) => void | Promise<void>;
