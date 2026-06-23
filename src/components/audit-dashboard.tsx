'use client';

import { AlertTriangle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { CompetitiveSection } from '@/components/dashboard/competitive-section';
import { EngineAnswer } from '@/components/dashboard/engine-answer';
import { RecommendationsList } from '@/components/dashboard/recommendations-list';
import { ScoreBar } from '@/components/dashboard/score-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DIMENSIONS, groupRunsByPrompt, scoreColor, scoreTier } from '@/lib/audit-report';
import { cn } from '@/lib/utils';
import type { AuditResult } from '@/server/audit/types';

interface AuditDashboardProps {
  result: AuditResult;
  /** Reinicia el flujo para auditar otra marca. */
  onNewAudit: () => void;
}

/** Delay incremental para el efecto cascada de entrada de las cards (reusa `animate-fade-in`). */
const fadeInDelay = (index: number): React.CSSProperties => ({ animationDelay: `${index * 80}ms` });

/**
 * Dashboard de resultados (Fase 6): el reporte completo de la auditoría. Compone, sobre el
 * `AuditResult`, el score titular + veredicto, el desglose por dimensión y por motor, el
 * posicionamiento competitivo, las citas textuales de cada motor y las recomendaciones AEO/GEO.
 */
export function AuditDashboard({ result, onNewAudit }: AuditDashboardProps) {
  const t = useTranslations('Audit.dashboard');
  const tIntent = useTranslations('Audit.progress');
  const locale = useLocale();
  const { score, profile, enginesUsed } = result;

  const auditedOn = new Date(result.createdAt).toLocaleString(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground text-sm">{t('subtitle', { brand: profile.name })}</p>
        <p className="text-muted-foreground text-xs">{t('auditedOn', { date: auditedOn })}</p>
      </header>

      {profile.degraded && (
        <p className="text-foreground flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>{t('degraded')}</span>
        </p>
      )}

      {/* Score titular + veredicto */}
      <Card className="animate-fade-in items-center text-center" style={fadeInDelay(0)}>
        <CardContent className="flex flex-col items-center gap-1 pt-2">
          <span className="text-muted-foreground text-sm">{t('scoreLabel')}</span>
          <span className={cn('text-6xl font-bold tabular-nums', scoreColor(score.overall))}>
            {Math.round(score.overall)}
          </span>
          <span className="text-muted-foreground text-xs">{t('scoreOutOf')}</span>
          <span className={cn('mt-1 text-sm font-medium', scoreColor(score.overall))}>
            {t(`tier.${scoreTier(score.overall)}`)}
          </span>
        </CardContent>
      </Card>

      {/* Desglose por dimensión */}
      <Card className="animate-fade-in" style={fadeInDelay(1)}>
        <CardHeader>
          <CardTitle className="text-base">{t('dimensionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {DIMENSIONS.map((dimension) => {
              const value = Math.round(score.dimensions[dimension]);
              return (
                <li key={dimension} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {t(`dimensions.${dimension}`)}
                      <span className="text-muted-foreground ml-2 text-xs">
                        {t(`dimensionDesc.${dimension}`)}
                      </span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">{value}</span>
                  </div>
                  <ScoreBar value={value} />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Desglose y comparación por motor */}
      {score.byEngine.length > 0 && (
        <Card className="animate-fade-in" style={fadeInDelay(2)}>
          <CardHeader>
            <CardTitle className="text-base">{t('byEngineTitle')}</CardTitle>
            <p className="text-muted-foreground text-sm">{t('byEngineSubtitle')}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {score.byEngine.map((engine) => (
              <div
                key={engine.engineId}
                className="border-border/60 flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{engine.label}</span>
                  <span
                    className={cn('text-2xl font-bold tabular-nums', scoreColor(engine.overall))}
                  >
                    {Math.round(engine.overall)}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {DIMENSIONS.map((dimension) => {
                    const value = Math.round(engine.dimensions[dimension]);
                    return (
                      <li key={dimension} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {t(`dimensions.${dimension}`)}
                          </span>
                          <span className="tabular-nums">{value}</span>
                        </div>
                        <ScoreBar value={value} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Posicionamiento competitivo */}
      <CompetitiveSection result={result} delay={fadeInDelay(3)} />

      {/* Citas textuales: todas las respuestas, agrupadas por pregunta */}
      <Card className="animate-fade-in" style={fadeInDelay(4)}>
        <CardHeader>
          <CardTitle className="text-base">{t('quotesTitle')}</CardTitle>
          <p className="text-muted-foreground text-sm">{t('quotesSubtitle')}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {groupRunsByPrompt(result).map(({ prompt, runs }) => (
            <div key={prompt.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs">
                  {tIntent(`intent.${prompt.intent}`)}
                </span>
                <p className="text-sm font-medium">{prompt.text}</p>
              </div>
              <div className="flex flex-col gap-3">
                {runs.map((run) => (
                  <EngineAnswer key={`${run.promptId}-${run.engineId}`} run={run} />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recomendaciones AEO/GEO */}
      <Card className="animate-fade-in" style={fadeInDelay(5)}>
        <CardHeader>
          <CardTitle className="text-base">{t('recommendationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <RecommendationsList score={score} />
        </CardContent>
      </Card>

      <div className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
        <span>{t('enginesUsed')}</span>
        <span className="text-foreground">
          {enginesUsed.map((engine) => `${engine.label} (${engine.model})`).join(' · ')}
        </span>
      </div>

      <div className="flex justify-center">
        <Button type="button" onClick={onNewAudit}>
          {t('newAudit')}
        </Button>
      </div>
    </section>
  );
}
