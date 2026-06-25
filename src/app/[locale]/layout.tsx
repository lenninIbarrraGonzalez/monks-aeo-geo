import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { HtmlLangSync } from '@/components/html-lang-sync';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Asegura que el locale entrante sea válido; si no, 404.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Habilita el renderizado estático para este locale.
  setRequestLocale(locale);

  // <html>, <body> y ThemeProvider viven en el root layout (src/app/layout.tsx) para que el script
  // anti-FOUC de next-themes no se vuelva a renderizar en el cliente al cambiar de idioma.
  return (
    <NextIntlClientProvider>
      <HtmlLangSync locale={locale} />
      {children}
    </NextIntlClientProvider>
  );
}
