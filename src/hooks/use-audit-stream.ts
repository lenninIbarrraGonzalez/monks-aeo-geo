'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createAuditStreamParser } from '@/lib/audit-stream';
import type { AuditErrorKind, AuditStreamEvent } from '@/server/audit/sse';
import type {
  AuditPrompt,
  AuditResult,
  AuditScore,
  BrandProfile,
  Locale,
} from '@/server/audit/types';
import type { EngineId } from '@/types/engine';

/** Fase del flujo de auditoría desde la perspectiva de la UI. */
export type AuditStatus = 'idle' | 'running' | 'done' | 'error';

/**
 * Códigos de error que la UI distingue para mensajes accionables. Extiende la taxonomía del wire
 * (`AuditErrorKind`) con `no_engines` (respuesta 503 antes de abrir el stream).
 */
export type AuditErrorCode = AuditErrorKind | 'unknown' | 'no_engines';

export interface AuditStreamError {
  kind: AuditErrorCode;
  message: string;
}

/** Estado derivado del stream que consumen los componentes de progreso/resumen. */
export interface AuditStreamState {
  status: AuditStatus;
  /** Marca que se está auditando (lo que se envió como `brand`). */
  brand: string;
  profile: BrandProfile | null;
  prompts: AuditPrompt[];
  /** `promptId → engineId → ok`: qué motor ya respondió cada prompt y si tuvo éxito. */
  answers: Record<string, Partial<Record<EngineId, boolean>>>;
  /** `promptId → true` cuando el juez ya analizó ese prompt. */
  judged: Record<string, boolean>;
  score: AuditScore | null;
  result: AuditResult | null;
  error: AuditStreamError | null;
}

const initialState: AuditStreamState = {
  status: 'idle',
  brand: '',
  profile: null,
  prompts: [],
  answers: {},
  judged: {},
  score: null,
  result: null,
  error: null,
};

export interface UseAuditStream extends AuditStreamState {
  /** Dispara una auditoría para `brand` en el idioma dado. Cancela cualquier corrida previa. */
  start: (brand: string, locale: Locale) => void;
  /** Aborta el stream en curso (el backend propaga el abort a las llamadas de motor). */
  cancel: () => void;
  /** Vuelve al estado inicial (`idle`) para empezar una auditoría nueva. */
  reset: () => void;
}

/**
 * Consume el endpoint SSE `/api/audit` y mantiene una máquina de estados con el progreso en vivo.
 *
 * Transporte: `POST` + `fetch` + `ReadableStream` (no `EventSource`), acorde a la Fase 4. Cada
 * evento del stream se aplica a un estado plano (objetos, no `Map`, para render directo en React).
 */
export function useAuditStream(): UseAuditStream {
  const [state, setState] = useState<AuditStreamState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState(initialState);
  }, [cancel]);

  const start = useCallback((brand: string, locale: Locale) => {
    // Cancelar cualquier corrida previa antes de abrir una nueva.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState({ ...initialState, status: 'running', brand });

    void consume(brand, locale, controller, mountedRef, setState);
  }, []);

  return { ...state, start, cancel, reset };
}

/** Lee el stream hasta el final y aplica cada evento al estado mientras el componente siga montado. */
async function consume(
  brand: string,
  locale: Locale,
  controller: AbortController,
  mountedRef: React.RefObject<boolean>,
  setState: React.Dispatch<React.SetStateAction<AuditStreamState>>,
): Promise<void> {
  const apply = (event: AuditStreamEvent) => {
    if (!mountedRef.current) return;
    setState((prev) => applyEvent(prev, event));
  };

  const fail = (kind: AuditErrorCode, message: string) => {
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, status: 'error', error: { kind, message } }));
  };

  let response: Response;
  try {
    response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, locale }),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) return; // cancelación deliberada: no es un error a mostrar
    fail('network', cause instanceof Error ? cause.message : 'fallo de red');
    return;
  }

  // 400 / 503: el servidor responde JSON `{ error }` sin abrir el stream.
  if (!response.ok || !response.body) {
    const message = await readErrorMessage(response);
    fail(statusToKind(response.status), message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createAuditStreamParser();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        apply(event);
      }
    }
  } catch (cause) {
    if (controller.signal.aborted) return; // cancelación deliberada
    fail('network', cause instanceof Error ? cause.message : 'se interrumpió el stream');
  }
}

/** Aplica un evento del stream al estado. Eventos desconocidos se ignoran (forward-compatible). */
function applyEvent(state: AuditStreamState, event: AuditStreamEvent): AuditStreamState {
  switch (event.type) {
    case 'profile':
      return { ...state, profile: event.profile };
    case 'prompts':
      return { ...state, prompts: event.prompts };
    case 'answer': {
      const prev = state.answers[event.promptId] ?? {};
      return {
        ...state,
        answers: {
          ...state.answers,
          [event.promptId]: { ...prev, [event.engineId]: event.ok },
        },
      };
    }
    case 'judged':
      return { ...state, judged: { ...state.judged, [event.promptId]: true } };
    case 'scored':
      return { ...state, score: event.score };
    case 'done':
      return { ...state, status: 'done', result: event.result, score: event.result.score };
    case 'error':
      return { ...state, status: 'error', error: { kind: event.kind, message: event.message } };
    default:
      return state;
  }
}

/** Mapea el status HTTP de una respuesta de error (sin stream) a un código que la UI entiende. */
function statusToKind(status: number): AuditErrorCode {
  if (status === 503) return 'no_engines';
  if (status === 400) return 'bad_request';
  return 'server';
}

/** Extrae el `error` del body JSON de una respuesta fallida; tolera bodies no-JSON. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  } catch {
    // body vacío o no-JSON: caemos al mensaje genérico
  }
  return `La auditoría falló (HTTP ${response.status})`;
}
