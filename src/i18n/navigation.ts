import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Wrappers de navegación conscientes del locale. Usar estos en lugar de los de
 * `next/navigation` / `next/link` para preservar el idioma activo en los enlaces.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
