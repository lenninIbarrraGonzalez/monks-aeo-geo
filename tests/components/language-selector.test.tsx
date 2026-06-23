// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageSelector } from '@/components/language-selector';

import { renderWithIntl, screen } from '../utils/render';

const replace = vi.fn();

// Los wrappers de navegación de next-intl dependen del router de Next; los mockeamos para
// observar el cambio de locale sin un router real. `usePathname` fija la ruta actual.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
}));

describe('LanguageSelector', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('marca como presionado el locale activo (es por defecto en el provider de test)', () => {
    renderWithIntl(<LanguageSelector />);

    expect(screen.getByRole('button', { name: 'es' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'en' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('cambia de idioma conservando la ruta al elegir otro locale', async () => {
    renderWithIntl(<LanguageSelector />);

    await userEvent.click(screen.getByRole('button', { name: 'en' }));

    expect(replace).toHaveBeenCalledExactlyOnceWith('/', { locale: 'en' });
  });

  it('no navega si se elige el locale ya activo', async () => {
    renderWithIntl(<LanguageSelector />);

    await userEvent.click(screen.getByRole('button', { name: 'es' }));

    expect(replace).not.toHaveBeenCalled();
  });
});
