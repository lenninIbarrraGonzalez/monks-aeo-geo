'use client';

import { useLocale, useTranslations } from 'next-intl';

import { AuditDashboard } from '@/components/audit-dashboard';
import { AuditError } from '@/components/audit-error';
import { AuditProgress } from '@/components/audit-progress';
import { BrandForm } from '@/components/brand-form';
import { ExampleBrands } from '@/components/example-brands';
import { useAuditStream } from '@/hooks/use-audit-stream';
import type { Locale } from '@/server/audit/types';

/**
 * Orquestador cliente de la experiencia de auditoría. Mantiene la máquina de estados del stream
 * (`useAuditStream`) y elige qué renderizar según el `status`:
 * `idle` → hero + formulario; `running` → progreso en vivo; `done` → resumen; `error` → error.
 */
export function AuditExperience() {
  const t = useTranslations('Home');
  const locale = useLocale() as Locale;
  const audit = useAuditStream();

  const startAudit = (brand: string) => audit.start(brand, locale);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      {audit.status === 'idle' && (
        <div className="flex w-full max-w-2xl flex-col items-center gap-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('title')}</h1>
            <p className="text-muted-foreground text-lg leading-8">{t('subtitle')}</p>
          </div>
          <div className="flex w-full flex-col items-center gap-8">
            <BrandForm onSubmit={startAudit} />
            <ExampleBrands onSelect={startAudit} />
          </div>
        </div>
      )}

      {audit.status === 'running' && <AuditProgress state={audit} onCancel={audit.reset} />}

      {audit.status === 'done' && audit.result && (
        <AuditDashboard result={audit.result} onNewAudit={audit.reset} />
      )}

      {audit.status === 'error' && audit.error && (
        <AuditError
          error={audit.error}
          onRetry={() => startAudit(audit.brand)}
          onNewAudit={audit.reset}
        />
      )}
    </main>
  );
}
