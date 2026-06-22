import { describe, expect, it } from 'vitest';
import { applyEvent, initialState } from '@/hooks/use-audit-stream';
import type { AuditResult } from '@/server/audit/types';

/** Estado base "corriendo", como lo deja `start` antes de leer el stream. */
const running = { ...initialState, status: 'running' as const, brand: 'Roku' };

describe('applyEvent', () => {
  it('guarda el perfil sin tocar el status', () => {
    const next = applyEvent(running, {
      type: 'profile',
      profile: {
        name: 'Roku',
        category: 'streaming',
        description: 'd',
        competitors: [],
        detectedBy: 'gemini',
      },
    });
    expect(next.profile?.name).toBe('Roku');
    expect(next.status).toBe('running');
  });

  it('acumula respuestas por prompt y motor sin pisar las previas', () => {
    const afterGemini = applyEvent(running, {
      type: 'answer',
      promptId: 'definitional',
      engineId: 'gemini',
      ok: true,
    });
    const afterGroq = applyEvent(afterGemini, {
      type: 'answer',
      promptId: 'definitional',
      engineId: 'groq',
      ok: false,
    });
    expect(afterGroq.answers.definitional).toEqual({ gemini: true, groq: false });
  });

  it('marca un prompt como juzgado', () => {
    const next = applyEvent(running, { type: 'judged', promptId: 'definitional' });
    expect(next.judged.definitional).toBe(true);
  });

  it('cierra con `done`: status done y score tomado del resultado', () => {
    const result = { score: { overall: 80 } } as AuditResult;
    const next = applyEvent(running, { type: 'done', result });
    expect(next.status).toBe('done');
    expect(next.result).toBe(result);
    expect(next.score).toBe(result.score);
  });

  it('mapea el evento `error` a status error con kind y mensaje', () => {
    const next = applyEvent(running, { type: 'error', kind: 'rate_limit', message: '' });
    expect(next.status).toBe('error');
    expect(next.error).toEqual({ kind: 'rate_limit', message: '' });
  });

  it('ignora eventos desconocidos (forward-compatible)', () => {
    const next = applyEvent(running, { type: 'futuro' } as never);
    expect(next).toBe(running);
  });
});
