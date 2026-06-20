/**
 * API pública del motor de auditoría AEO/GEO.
 *
 * La capa de API (Fase 4) y la UI deben importar desde aquí, no desde los módulos internos.
 */

export type {
  Locale,
  PromptIntent,
  BrandProfile,
  AuditPrompt,
  Sentiment,
  JudgeSignals,
  EngineRun,
  DimensionScores,
  EngineScore,
  AuditScore,
  EngineInfo,
  AuditResult,
  AuditProgress,
  ProgressHandler,
} from './types';

export { runAudit, type RunAuditOptions } from './orchestrator';
export { buildPrompts } from './prompts';
export { computeScore, DIMENSION_WEIGHTS } from './scoring';
export { detectBrandProfile } from './profile';
export { judgePrompt, ABSENT_SIGNALS, type AnswerToJudge } from './judge';
export { generateStructured, extractJsonText } from './json';
