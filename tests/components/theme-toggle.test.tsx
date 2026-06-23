// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from '@/components/theme-toggle';

import { renderWithIntl, screen } from '../utils/render';

const setTheme = vi.fn();
let currentTheme = 'system';

// next-themes depende del runtime del navegador; lo mockeamos para controlar el tema activo.
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    setTheme.mockClear();
    currentTheme = 'system';
  });

  it('marca como presionado el tema activo tras montar (guard de hidratación)', async () => {
    currentTheme = 'dark';
    renderWithIntl(<ThemeToggle />);

    // El guard de montaje resuelve el aria-pressed en el cliente.
    const dark = await screen.findByRole('button', { name: 'Oscuro' });
    expect(dark).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('aplica el tema elegido al hacer clic', async () => {
    renderWithIntl(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button', { name: 'Claro' }));

    expect(setTheme).toHaveBeenCalledExactlyOnceWith('light');
  });

  it('expone un grupo accesible con las tres opciones de tema', () => {
    renderWithIntl(<ThemeToggle />);

    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
    for (const label of ['Claro', 'Oscuro', 'Sistema']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });
});
