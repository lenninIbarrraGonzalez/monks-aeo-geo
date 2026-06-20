import { describe, expect, it } from 'vitest';
import { runAudit } from '@/server/audit/orchestrator';
import type { AuditProgress } from '@/server/audit/types';
import { isEngineError } from '@/server/engines';
import type { Engine } from '@/server/engines';
import { fakeEngine, throwingEngine } from './_fakes';

/** Analista que detecta el perfil OK pero falla en cada llamada del juez. */
function analystFailingJudge(): Engine {
  let calls = 0;
  return {
    id: 'gemini',
    label: 'GEMINI',
    model: 'm',
    async generate() {
      calls += 1;
      if (calls === 1) {
        return { engineId: 'gemini', label: 'GEMINI', model: 'm', text: profileJSON };
      }
      throw new Error('judge boom');
    },
  };
}

const profileJSON = JSON.stringify({
  category: 'software de notas',
  description: 'Workspace todo-en-uno.',
  competitors: ['Evernote'],
  url: 'https://notion.so',
});

const judgeJSON = JSON.stringify({
  results: [
    {
      engine: 'gemini',
      mentioned: true,
      accuracy: 1,
      sentiment: 'positive',
      competitivePosition: 1,
      citedSource: true,
    },
    {
      engine: 'groq',
      mentioned: true,
      accuracy: 0.5,
      sentiment: 'neutral',
      competitivePosition: 2,
      citedSource: false,
    },
  ],
});

/** Analista: 1ª llamada = perfil, resto = juez (fakeEngine repite el último). */
function analyst() {
  return fakeEngine([profileJSON, judgeJSON]);
}

describe('runAudit', () => {
  it('corre el flujo completo y arma un AuditResult coherente', async () => {
    const gemini = fakeEngine(['Notion es un workspace.'], 'gemini');
    const groq = fakeEngine(['Una buena opción es Notion.'], 'groq');
    const events: AuditProgress['type'][] = [];

    const result = await runAudit('Notion', {
      engines: [gemini, groq],
      analyst: analyst(),
      locale: 'es',
      onProgress: (e) => {
        events.push(e.type);
      },
    });

    // 6 prompts (incluye vs porque hay competidor) × 2 motores = 12 runs.
    expect(result.prompts).toHaveLength(6);
    expect(result.runs).toHaveLength(12);
    expect(result.profile.category).toBe('software de notas');
    expect(result.enginesUsed.map((e) => e.id)).toEqual(['gemini', 'groq']);
    expect(result.score.overall).toBeGreaterThan(0);
    expect(result.score.byEngine).toHaveLength(2);
    expect(result.locale).toBe('es');

    expect(events).toContain('profile');
    expect(events).toContain('prompts');
    expect(events).toContain('answer');
    expect(events).toContain('judged');
    expect(events).toContain('scored');
  });

  it('continúa si un motor falla: registra el error en sus celdas', async () => {
    const gemini = fakeEngine(['Notion es un workspace.'], 'gemini');
    const groq = throwingEngine('groq');

    const result = await runAudit('Notion', {
      engines: [gemini, groq],
      analyst: analyst(),
    });

    const groqRuns = result.runs.filter((r) => r.engineId === 'groq');
    expect(groqRuns.every((r) => r.error)).toBe(true);
    expect(groqRuns.every((r) => r.answer === '')).toBe(true);
    // El score de Gemini sigue siendo válido pese al fallo de Groq.
    const gemini1 = result.score.byEngine.find((e) => e.engineId === 'gemini');
    expect(gemini1?.overall).toBeGreaterThan(0);
  });

  it('marca las celdas como error (excluidas del scoring) si el juez falla', async () => {
    const gemini = fakeEngine(['Notion es un workspace.'], 'gemini');
    const groq = fakeEngine(['Otra opción es Notion.'], 'groq');

    const result = await runAudit('Notion', {
      engines: [gemini, groq],
      analyst: analystFailingJudge(),
    });

    // Los motores respondieron, pero el juez falló en cada prompt: todas las celdas con error.
    expect(result.runs.every((r) => r.error)).toBe(true);
    expect(result.runs.every((r) => r.answer.length > 0)).toBe(true);
    // Sin celdas válidas, el score es 0 pero la auditoría no rompe.
    expect(result.score.overall).toBe(0);
  });

  it('lanza EngineError si no hay motores disponibles', async () => {
    await expect(runAudit('Notion', { engines: [] })).rejects.toSatisfy(isEngineError);
  });
});
