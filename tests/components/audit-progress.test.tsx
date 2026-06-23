// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuditProgress } from '@/components/audit-progress';
import { initialState, type AuditStreamState } from '@/hooks/use-audit-stream';
import type { BrandProfile } from '@/server/audit/types';

import { renderWithIntl, screen, within } from '../utils/render';

const PROFILE: BrandProfile = {
  name: 'Notion',
  category: 'Productividad',
  description: 'Espacio de trabajo todo en uno.',
  competitors: ['Coda', 'Obsidian'],
  detectedBy: 'gemini',
};

function buildState(overrides: Partial<AuditStreamState> = {}): AuditStreamState {
  return { ...initialState, status: 'running', brand: 'Notion', ...overrides };
}

describe('AuditProgress', () => {
  it('marca el stepper según el hito alcanzado (perfil = paso 1 activo)', () => {
    renderWithIntl(<AuditProgress state={buildState({ profile: PROFILE })} onCancel={vi.fn()} />);

    expect(screen.getByText('Detectando perfil')).toBeInTheDocument();
    // El perfil detectado se anuncia en la zona aria-live.
    expect(screen.getByText('Espacio de trabajo todo en uno.')).toBeInTheDocument();
    expect(screen.getByText('Coda, Obsidian')).toBeInTheDocument();
  });

  it('renderiza la matriz prompt × motor con el estado de cada celda', () => {
    const state = buildState({
      profile: PROFILE,
      prompts: [{ id: 'p1', intent: 'definitional', text: '¿Qué es Notion?', mentionsBrand: true }],
      answers: { p1: { gemini: true, groq: false } },
    });
    renderWithIntl(<AuditProgress state={state} onCancel={vi.fn()} />);

    const gemini = screen.getByTitle('Gemini: Respondió');
    const groq = screen.getByTitle('Groq: Falló');
    expect(gemini).toBeInTheDocument();
    expect(groq).toBeInTheDocument();
    expect(within(gemini).getByText('Gemini')).toBeInTheDocument();
  });

  it('muestra una celda como pendiente cuando un motor aún no respondió ese prompt', () => {
    const state = buildState({
      prompts: [{ id: 'p1', intent: 'definitional', text: '¿Qué es Notion?', mentionsBrand: true }],
      // gemini respondió p1; groq aparece como columna pero sin dato para p1 → pendiente.
      answers: { p1: { gemini: true }, p2: { groq: true } },
    });
    renderWithIntl(<AuditProgress state={state} onCancel={vi.fn()} />);

    expect(screen.getByTitle('Groq: Pendiente')).toBeInTheDocument();
  });

  it('marca el prompt como analizado cuando el juez terminó', () => {
    const state = buildState({
      prompts: [{ id: 'p1', intent: 'definitional', text: '¿Qué es Notion?', mentionsBrand: true }],
      answers: { p1: { gemini: true } },
      judged: { p1: true },
    });
    renderWithIntl(<AuditProgress state={state} onCancel={vi.fn()} />);

    expect(screen.getByText('Analizado')).toBeInTheDocument();
  });

  it('dispara onCancel al pulsar Cancelar', async () => {
    const onCancel = vi.fn();
    renderWithIntl(<AuditProgress state={buildState()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
