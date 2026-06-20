'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AuditResult, DimensionScores } from '@/server/audit/types';

const DIMENSIONS: (keyof DimensionScores)[] = [
  'presence',
  'accuracy',
  'sentiment',
  'competitive',
  'citation',
];

interface AuditSummaryProps {
  result: AuditResult;
  /** Reinicia el flujo para auditar otra marca. */
  onNewAudit: () => void;
}

/**
 * Estado final mínimo de la Fase 5: AI Visibility Score titular + desglose por dimensión + motores
 * consultados. El dashboard detallado (citas, comparación, recomendaciones) llega en la Fase 6.
 */
export function AuditSummary({ result, onNewAudit }: AuditSummaryProps) {
  const t = useTranslations('Audit.summary');
  const { score, profile, enginesUsed } = result;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground text-sm">{t('subtitle', { brand: profile.name })}</p>
      </header>

      <Card className="animate-fade-in items-center text-center">
        <CardContent className="flex flex-col items-center gap-1 pt-2">
          <span className="text-muted-foreground text-sm">{t('scoreLabel')}</span>
          <span className={cn('text-6xl font-bold tabular-nums', scoreColor(score.overall))}>
            {Math.round(score.overall)}
          </span>
          <span className="text-muted-foreground text-xs">{t('scoreOutOf')}</span>
        </CardContent>
      </Card>

      <Card className="animate-fade-in">
        <CardContent className="flex flex-col gap-4 pt-2">
          <h3 className="text-sm font-medium">{t('dimensionsTitle')}</h3>
          <ul className="flex flex-col gap-3">
            {DIMENSIONS.map((dimension) => {
              const value = Math.round(score.dimensions[dimension]);
              return (
                <li key={dimension} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t(`dimensions.${dimension}`)}</span>
                    <span className="text-muted-foreground tabular-nums">{value}</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor(value))}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
        <span>{t('enginesUsed')}</span>
        <span className="text-foreground">
          {enginesUsed.map((engine) => `${engine.label} (${engine.model})`).join(' · ')}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Button type="button" variant="outline" disabled>
          {t('viewReport')} · {t('viewReportSoon')}
        </Button>
        <Button type="button" onClick={onNewAudit}>
          {t('newAudit')}
        </Button>
      </div>
    </section>
  );
}

/** Color del número titular según el tramo del score. */
function scoreColor(value: number): string {
  if (value >= 67) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 34) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

/** Color de la barra de una dimensión según su valor. */
function barColor(value: number): string {
  if (value >= 67) return 'bg-emerald-500';
  if (value >= 34) return 'bg-amber-500';
  return 'bg-destructive';
}
