'use client';

import { useEffect } from 'react';

type Props = {
  locale: string;
};

/**
 * Mantiene `<html lang>` en sincronía con el locale activo. El elemento <html> vive en el layout
 * raíz, que no se re-renderiza durante los cambios de idioma client-side de next-intl, así que el
 * atributo se actualiza acá vía efecto — el mismo enfoque que usa next-themes para la clase del tema.
 */
export function HtmlLangSync({ locale }: Props) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
