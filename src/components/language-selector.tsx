'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Toggle de idioma es/en. Cambia el locale conservando la ruta actual mediante los wrappers de
 * `@/i18n/navigation`; con `localePrefix: 'as-needed'` el router agrega/quita el prefijo `/en`.
 */
export function LanguageSelector() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: (typeof routing.locales)[number]) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      role="group"
      aria-label={t('languageSwitcher')}
      className="border-border/70 inline-flex items-center rounded-md border p-0.5 text-sm"
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          aria-pressed={loc === locale}
          disabled={isPending}
          title={loc === 'es' ? t('spanish') : t('english')}
          className={cn(
            'rounded px-2.5 py-1 font-medium uppercase transition-colors disabled:opacity-60',
            loc === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
