'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AuditStreamError } from '@/hooks/use-audit-stream';

interface AuditErrorProps {
  error: AuditStreamError;
  /** Reintenta la misma auditoría. */
  onRetry: () => void;
  /** Vuelve al inicio para auditar otra marca. */
  onNewAudit: () => void;
}

/** Estado de error: mensaje accionable según el `kind` + el detalle crudo del servidor. */
export function AuditError({ error, onRetry, onNewAudit }: AuditErrorProps) {
  const t = useTranslations('Audit.error');

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Card className="animate-fade-in border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-full">
            <AlertTriangle className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-muted-foreground text-sm">{t(`kind.${error.kind}`)}</p>
          {error.message && (
            <p className="text-muted-foreground/70 font-mono text-xs break-words">
              {error.message}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Button type="button" onClick={onRetry}>
          {t('retry')}
        </Button>
        <Button type="button" variant="outline" onClick={onNewAudit}>
          {t('newAudit')}
        </Button>
      </div>
    </section>
  );
}
