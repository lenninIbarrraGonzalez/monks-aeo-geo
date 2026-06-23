// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuditError } from '@/components/audit-error';
import type { AuditStreamError } from '@/hooks/use-audit-stream';

import { renderWithIntl, screen } from '../utils/render';

function renderError(error: AuditStreamError, handlers: Partial<{ onRetry: () => void; onNewAudit: () => void }> = {}) {
  const onRetry = handlers.onRetry ?? vi.fn();
  const onNewAudit = handlers.onNewAudit ?? vi.fn();
  renderWithIntl(<AuditError error={error} onRetry={onRetry} onNewAudit={onNewAudit} />);
  return { onRetry, onNewAudit };
}

describe('AuditError', () => {
  it('muestra el mensaje localizado correspondiente al kind del error', () => {
    renderError({ kind: 'rate_limit', message: '' });

    expect(
      screen.getByText('Los motores de IA están saturados por límite de uso. Esperá un momento y reintentá.'),
    ).toBeInTheDocument();
  });

  it('mapea no_engines (código solo de UI) a su mensaje propio', () => {
    renderError({ kind: 'no_engines', message: '' });

    expect(screen.getByText('No hay motores de IA configurados en el servidor.')).toBeInTheDocument();
  });

  it('muestra el detalle crudo del servidor solo cuando hay message', () => {
    const { rerender } = renderWithIntl(
      <AuditError error={{ kind: 'server', message: 'boom: upstream 500' }} onRetry={vi.fn()} onNewAudit={vi.fn()} />,
    );
    expect(screen.getByText('boom: upstream 500')).toBeInTheDocument();

    rerender(<AuditError error={{ kind: 'server', message: '' }} onRetry={vi.fn()} onNewAudit={vi.fn()} />);
    expect(screen.queryByText('boom: upstream 500')).not.toBeInTheDocument();
  });

  it('invoca onRetry y onNewAudit desde sus botones', async () => {
    const { onRetry, onNewAudit } = renderError({ kind: 'network', message: '' });

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onNewAudit).toHaveBeenCalledOnce();
  });
});
