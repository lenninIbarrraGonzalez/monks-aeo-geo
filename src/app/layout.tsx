import { Geist, Geist_Mono } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

type Props = {
  children: React.ReactNode;
};

/**
 * Layout raíz compartido por todos los locales. Al ser dueño de <html>, <body> y ThemeProvider,
 * el <script> anti-FOUC de next-themes se renderiza una sola vez y nunca se vuelve a renderizar
 * durante los cambios de idioma client-side (solo se re-renderiza el layout anidado de [locale]);
 * así se evita el warning de React 19 "script tag while rendering on the client". El atributo
 * `lang` se inicializa con el locale del request y HtmlLangSync lo mantiene en sincronía al navegar.
 */
export default async function RootLayout({ children }: Props) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
