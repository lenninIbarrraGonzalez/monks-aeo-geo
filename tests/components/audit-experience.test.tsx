// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UseAuditStream } from '@/hooks/use-audit-stream';

import { renderWithIntl, screen } from '../utils/render';

const { mockUseAuditStream } = vi.hoisted(() => ({ mockUseAuditStream: vi.fn() }));

vi.mock('@/hooks/use-audit-stream', () => ({
  useAuditStream: () => mockUseAuditStream(),
}));

// Hijos reemplazados por stubs: aquí solo probamos el ruteo por `status` y el cableado de callbacks.
vi.mock('@/components/brand-form', () => ({
  BrandForm: ({ onSubmit }: { onSubmit: (brand: string) => void }) => (
    <button type="button" onClick={() => onSubmit('Notion')}>
      stub-brand-form
    </button>
  ),
}));
vi.mock('@/components/example-brands', () => ({
  ExampleBrands: () => <div data-testid="stub-examples" />,
}));
vi.mock('@/components/audit-progress', () => ({
  AuditProgress: ({ onCancel }: { onCancel: () => void }) => (
    <button type="button" onClick={onCancel}>
      stub-progress
    </button>
  ),
}));
vi.mock('@/components/audit-dashboard', () => ({
  AuditDashboard: ({ onNewAudit }: { onNewAudit: () => void }) => (
    <button type="button" onClick={onNewAudit}>
      stub-dashboard
    </button>
  ),
}));
vi.mock('@/components/audit-error', () => ({
  AuditError: ({ onRetry, onNewAudit }: { onRetry: () => void; onNewAudit: () => void }) => (
    <div>
      <button type="button" onClick={onRetry}>
        stub-error-retry
      </button>
      <button type="button" onClick={onNewAudit}>
        stub-error-newaudit
      </button>
    </div>
  ),
}));

import { AuditExperience } from '@/components/audit-experience';

/** Estado base del hook con todos los handlers espiables; cada test sobrescribe lo que necesita. */
function streamState(overrides: Partial<UseAuditStream> = {}): UseAuditStream {
  return {
    status: 'idle',
    brand: '',
    profile: null,
    prompts: [],
    answers: {},
    judged: {},
    score: null,
    result: null,
    error: null,
    start: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuditExperience', () => {
  it('en idle muestra el formulario y dispara start con la marca y el locale', async () => {
    const start = vi.fn();
    mockUseAuditStream.mockReturnValue(streamState({ start }));
    renderWithIntl(<AuditExperience />);

    expect(screen.getByTestId('stub-examples')).toBeInTheDocument();
    await userEvent.click(screen.getByText('stub-brand-form'));

    expect(start).toHaveBeenCalledExactlyOnceWith('Notion', 'es');
  });

  it('en running muestra el progreso y cancelar invoca reset', async () => {
    const reset = vi.fn();
    mockUseAuditStream.mockReturnValue(streamState({ status: 'running', reset }));
    renderWithIntl(<AuditExperience />);

    await userEvent.click(screen.getByText('stub-progress'));

    expect(reset).toHaveBeenCalledOnce();
  });

  it('en done muestra el dashboard y nueva auditoría invoca reset', async () => {
    const reset = vi.fn();
    mockUseAuditStream.mockReturnValue(
      streamState({ status: 'done', result: {} as UseAuditStream['result'], reset }),
    );
    renderWithIntl(<AuditExperience />);

    await userEvent.click(screen.getByText('stub-dashboard'));

    expect(reset).toHaveBeenCalledOnce();
  });

  it('en error reintenta con la marca previa y permite empezar de cero', async () => {
    const start = vi.fn();
    const reset = vi.fn();
    mockUseAuditStream.mockReturnValue(
      streamState({
        status: 'error',
        brand: 'Roku',
        error: { kind: 'server', message: 'boom' },
        start,
        reset,
      }),
    );
    renderWithIntl(<AuditExperience />);

    await userEvent.click(screen.getByText('stub-error-retry'));
    expect(start).toHaveBeenCalledExactlyOnceWith('Roku', 'es');

    await userEvent.click(screen.getByText('stub-error-newaudit'));
    expect(reset).toHaveBeenCalledOnce();
  });
});
