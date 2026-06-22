// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuditDashboard } from '@/components/audit-dashboard';
import type { AuditResult, DimensionScores, EngineRun, JudgeSignals } from '@/server/audit/types';

import messages from '../../messages/es.json';
import { renderWithIntl, screen } from '../utils/render';

const dash = messages.Audit.dashboard;

const SIGNALS: JudgeSignals = {
  mentioned: true,
  accuracy: 0.8,
  sentiment: 'positive',
  competitivePosition: null,
  citedSource: false,
};

function dims(overrides: Partial<DimensionScores> = {}): DimensionScores {
  return { presence: 0, accuracy: 0, sentiment: 0, competitive: 0, citation: 0, ...overrides };
}

function run(overrides: Partial<EngineRun> = {}): EngineRun {
  return {
    promptId: 'definitional',
    intent: 'definitional',
    engineId: 'gemini',
    label: 'Gemini',
    model: 'gemini-2.5-flash',
    answer: 'respuesta',
    signals: { ...SIGNALS, ...(overrides.signals ?? {}) },
    ...overrides,
  };
}

/** `AuditResult` realista: dos prompts, dos motores y las tres ramas de celda (ok / fallida / sin análisis). */
function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    profile: {
      name: 'Roku',
      category: 'plataformas de streaming',
      description: 'Reproductores y TVs con sistema operativo de streaming.',
      competitors: ['Amazon Fire TV', 'Chromecast'],
      detectedBy: 'gemini',
    },
    prompts: [
      { id: 'definitional', intent: 'definitional', text: '¿Qué es Roku?', mentionsBrand: true },
      {
        id: 'categorical',
        intent: 'categorical',
        text: 'Mejores plataformas de streaming',
        mentionsBrand: false,
      },
    ],
    runs: [
      run({
        promptId: 'definitional',
        engineId: 'gemini',
        answer: 'Roku lidera el mercado de streaming.',
        signals: { ...SIGNALS, competitivePosition: 2, citedSource: true },
      }),
      run({
        promptId: 'definitional',
        engineId: 'groq',
        label: 'Llama 3.3 70B',
        model: 'llama-3.3-70b',
        answer: 'Roku es un reproductor de streaming.',
      }),
      // Celda fallida: el motor no respondió (answer vacío).
      run({
        promptId: 'categorical',
        engineId: 'gemini',
        answer: '',
        error: 'rate limit',
      }),
      // Celda con respuesta pero sin análisis del juez.
      run({
        promptId: 'categorical',
        engineId: 'groq',
        label: 'Llama 3.3 70B',
        model: 'llama-3.3-70b',
        answer: 'Entre las mejores está Roku.',
        error: 'judge failed',
      }),
    ],
    score: {
      overall: 79,
      dimensions: dims({
        presence: 100,
        accuracy: 83,
        sentiment: 82,
        competitive: 71,
        citation: 12,
      }),
      byEngine: [
        {
          engineId: 'gemini',
          label: 'Gemini',
          overall: 64,
          dimensions: dims({
            presence: 90,
            accuracy: 70,
            sentiment: 65,
            competitive: 60,
            citation: 10,
          }),
        },
        {
          engineId: 'groq',
          label: 'Llama 3.3 70B',
          overall: 58,
          dimensions: dims({
            presence: 88,
            accuracy: 66,
            sentiment: 62,
            competitive: 55,
            citation: 8,
          }),
        },
      ],
    },
    enginesUsed: [
      { id: 'gemini', label: 'Gemini', model: 'gemini-2.5-flash' },
      { id: 'groq', label: 'Llama 3.3 70B', model: 'llama-3.3-70b' },
    ],
    locale: 'es',
    createdAt: '2026-06-22T12:00:00.000Z',
    ...overrides,
  };
}

describe('AuditDashboard', () => {
  it('muestra el score titular y el veredicto del tramo correspondiente', () => {
    renderWithIntl(<AuditDashboard result={makeResult()} onNewAudit={vi.fn()} />);

    expect(screen.getByText('79')).toBeInTheDocument();
    // overall 79 ≥ 67 → tramo alto
    expect(screen.getByText(dash.tier.high)).toBeInTheDocument();
  });

  it('renderiza el desglose por motor con su score individual', () => {
    renderWithIntl(<AuditDashboard result={makeResult()} onNewAudit={vi.fn()} />);

    expect(screen.getByText('64')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
  });

  it('muestra las citas textuales y las tres ramas de estado de celda', () => {
    renderWithIntl(<AuditDashboard result={makeResult()} onNewAudit={vi.fn()} />);

    expect(screen.getByText('Roku lidera el mercado de streaming.')).toBeInTheDocument();
    // celda fallida (answer vacío)
    expect(screen.getByText(dash.cellFailed)).toBeInTheDocument();
    // celda con respuesta pero análisis no disponible
    expect(screen.getByText(dash.analysisUnavailable)).toBeInTheDocument();
  });

  it('lista los competidores y los motores usados', () => {
    renderWithIntl(<AuditDashboard result={makeResult()} onNewAudit={vi.fn()} />);

    expect(screen.getByText('Amazon Fire TV')).toBeInTheDocument();
    expect(screen.getByText('Chromecast')).toBeInTheDocument();
    expect(screen.getByText(/Gemini \(gemini-2\.5-flash\)/)).toBeInTheDocument();
  });

  it('muestra el aviso de perfil degradado solo cuando corresponde', () => {
    const { rerender } = renderWithIntl(
      <AuditDashboard result={makeResult()} onNewAudit={vi.fn()} />,
    );
    expect(screen.queryByText(dash.degraded)).not.toBeInTheDocument();

    const degraded = makeResult();
    degraded.profile.degraded = true;
    rerender(<AuditDashboard result={degraded} onNewAudit={vi.fn()} />);
    expect(screen.getByText(dash.degraded)).toBeInTheDocument();
  });

  it('invoca onNewAudit al pulsar el botón de nueva auditoría', async () => {
    const onNewAudit = vi.fn();
    renderWithIntl(<AuditDashboard result={makeResult()} onNewAudit={onNewAudit} />);

    await userEvent.click(screen.getByRole('button', { name: dash.newAudit }));

    expect(onNewAudit).toHaveBeenCalledOnce();
  });
});
