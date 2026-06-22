// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BrandForm } from '@/components/brand-form';

import { renderWithIntl, screen } from '../utils/render';

describe('BrandForm', () => {
  it('envía la marca recortada cuando el valor no está vacío', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(<BrandForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole('textbox'), '  Notion  ');
    await userEvent.click(screen.getByRole('button'));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Notion');
  });

  it('no envía y marca el campo como inválido cuando está vacío', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(<BrandForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'brand-error');
  });

  it('limpia el estado de error en cuanto el usuario vuelve a escribir', async () => {
    const onSubmit = vi.fn();
    renderWithIntl(<BrandForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'F');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });
});
