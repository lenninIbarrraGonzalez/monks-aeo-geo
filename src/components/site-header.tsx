import { useTranslations } from 'next-intl';

import { LanguageSelector } from '@/components/language-selector';
import { ThemeToggle } from '@/components/theme-toggle';

/** Barra superior del sitio: nombre de la app + selector de tema e idioma. */
export function SiteHeader() {
  const t = useTranslations('Common');

  return (
    <header className="border-border/60 flex items-center justify-between border-b px-6 py-4">
      <span className="text-sm font-semibold tracking-tight">{t('appName')}</span>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageSelector />
      </div>
    </header>
  );
}
