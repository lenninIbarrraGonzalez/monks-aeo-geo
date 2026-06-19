import { defineRouting } from 'next-intl/routing';

/**
 * Configuración de enrutamiento i18n.
 *
 * - `es` es el idioma por defecto y se sirve sin prefijo (`/`).
 * - `en` se sirve bajo el prefijo `/en` (`localePrefix: 'as-needed'`).
 */
export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
