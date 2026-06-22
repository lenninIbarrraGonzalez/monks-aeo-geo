'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/** Opciones de tema: claro / oscuro / sistema, con su ícono y la clave de traducción del label. */
const THEMES = [
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
] as const;

/**
 * Toggle de tema claro/oscuro/sistema. Aplica la clase `dark` al `<html>` vía next-themes (que
 * matchea el `@custom-variant dark` de `globals.css`). El guard de montaje evita el mismatch SSR:
 * el tema activo solo se conoce en el cliente, así que hasta montar no marcamos ninguno como activo.
 */
export function ThemeToggle() {
  const t = useTranslations('Common');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Guard de montaje de next-themes: el tema activo solo existe en el cliente, así que esperamos
  // al montaje para marcar `aria-pressed` y evitar el mismatch de hidratación. El setState en el
  // efecto es intencional acá (correr una sola vez tras montar), de ahí el disable puntual.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div
      role="group"
      aria-label={t('themeSwitcher')}
      className="border-border/70 inline-flex items-center rounded-md border p-0.5"
    >
      {THEMES.map(({ value, icon: Icon, labelKey }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            className={cn(
              'flex items-center justify-center rounded p-1.5 transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
