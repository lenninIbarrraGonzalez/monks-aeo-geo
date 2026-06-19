/**
 * API pública de la capa de motores de IA.
 *
 * La auditoría (Fase 3) debe importar desde aquí, no desde los módulos internos.
 */
export type {
  ChatMessage,
  ChatRole,
  EngineId,
  EngineRequest,
  EngineResponse,
  EngineErrorKind,
  EngineUsage,
} from '@/types/engine';
export type { Engine } from './base';
export type { EngineConfig } from './env';
export { EngineError, isEngineError } from './errors';
export { getAvailableEngines, getEngine, hasAnyEngine } from './registry';
