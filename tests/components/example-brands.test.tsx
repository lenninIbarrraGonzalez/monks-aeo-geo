// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExampleBrands } from '@/components/example-brands';

import { renderWithIntl, screen } from '../utils/render';

describe('ExampleBrands', () => {
  it('renderiza un botón por cada marca de ejemplo', () => {
    renderWithIntl(<ExampleBrands onSelect={vi.fn()} />);

    for (const brand of ['Notion', 'Figma', 'Stripe', 'Linear', 'Mercado Libre']) {
      expect(screen.getByRole('button', { name: brand })).toBeInTheDocument();
    }
  });

  it('dispara onSelect con la marca exacta al hacer clic', async () => {
    const onSelect = vi.fn();
    renderWithIntl(<ExampleBrands onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Stripe' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('Stripe');
  });
});
