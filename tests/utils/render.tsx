import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import messages from '../../messages/es.json';

/**
 * Helper de render para componentes que dependen de `next-intl`. Envuelve el árbol con el provider
 * cargando los mensajes reales en español, de modo que los tests ejerciten las traducciones de
 * verdad (no claves crudas). `timeZone` fijo para que cualquier formato de fecha sea determinístico.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Wrapper, ...options });
}

// Reexporta la API de Testing Library para importar todo desde un único lugar.
export * from '@testing-library/react';
