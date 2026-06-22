'use client';

import { AlertTriangle, Check, Link2, Quote, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DIMENSIONS,
  barColor,
  deriveCompetitive,
  deriveRecommendations,
  groupRunsByPrompt,
  scoreColor,
  scoreTier,
} from '@/lib/audit-report';
import { cn } from '@/lib/utils';
import type { AuditResult, EngineRun, Sentiment } from '@/server/audit/types';

interface AuditDashboardProps {
  result: AuditResult;
  /** Reinicia el flujo para auditar otra marca. */
  onNewAudit: () => void;
}

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
        <p className="border-amber-500/40 bg-amber-500/10 text-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{t('degraded')}</span>
        </p>
      )}

      {/* Score titular + veredicto */}
      <Card className="animate-fade-in items-center text-center">
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
      <Card className="animate-fade-in">
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
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-base">{t('byEngineTitle')}</CardTitle>
            <p className="text-muted-foreground text-sm">{t('byEngineSubtitle')}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {score.byEngine.map((engine) => (
              <div key={engine.engineId} className="border-border/60 flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{engine.label}</span>
                  <span className={cn('text-2xl font-bold tabular-nums', scoreColor(engine.overall))}>
                    {Math.round(engine.overall)}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {DIMENSIONS.map((dimension) => {
                    const value = Math.round(engine.dimensions[dimension]);
                    return (
                      <li key={dimension} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t(`dimensions.${dimension}`)}</span>
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
      <CompetitiveSection result={result} />

      {/* Citas textuales: todas las respuestas, agrupadas por pregunta */}
      <Card className="animate-fade-in">
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
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="text-base">{t('recommendationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(() => {
            const recommendations = deriveRecommendations(score);
            if (recommendations.length === 0) {
              return <p className="text-muted-foreground text-sm">{t('recommendationsPositive')}</p>;
            }
            return (
              <ul className="flex flex-col gap-3">
                {recommendations.map(({ dimension, tier }) => (
                  <li key={dimension} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-xs font-medium',
                          tier === 'low'
                            ? 'border-destructive/40 text-destructive'
                            : 'border-amber-500/40 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {t(`severity.${tier}`)}
                      </span>
                      <span className="text-sm font-medium">{t(`dimensions.${dimension}`)}</span>
                    </div>
                    <p className="text-muted-foreground text-sm">{t(`recommendation.${dimension}`)}</p>
                  </li>
                ))}
              </ul>
            );
          })()}
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

/** Barra de progreso 0–100 con color por tramo (patrón compartido del reporte). */
function ScoreBar({ value }: { value: number }) {
  return (
    <div className="bg-muted h-2 overflow-hidden rounded-full">
      <div
        className={cn('h-full rounded-full transition-all', barColor(value))}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/** Sección de posicionamiento competitivo, con estado vacío honesto si no hubo comparación. */
function CompetitiveSection({ result }: { result: AuditResult }) {
  const t = useTranslations('Audit.dashboard');
  const competitive = deriveCompetitive(result);
  const score = Math.round(result.score.dimensions.competitive);

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-base">{t('competitiveTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {competitive.hasData ? (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span>{t('dimensions.competitive')}</span>
                <span className="text-muted-foreground tabular-nums">{score}</span>
              </div>
              <ScoreBar value={score} />
            </div>
            <p>{t('competitiveBest', { position: competitive.bestPosition ?? 0 })}</p>
          </>
        ) : (
          <p className="text-muted-foreground">{t('competitiveEmpty')}</p>
        )}

        {competitive.competitors.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">{t('competitiveCompetitors')}</span>
            <div className="flex flex-wrap gap-2">
              {competitive.competitors.map((competitor) => (
                <span key={competitor} className="border-border rounded-full border px-2 py-0.5 text-xs">
                  {competitor}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Respuesta textual de un motor para un prompt, con sus señales o su estado de error. */
function EngineAnswer({ run }: { run: EngineRun }) {
  const t = useTranslations('Audit.dashboard');
  const failed = Boolean(run.error) || run.answer.trim().length === 0;

  return (
    <div className="border-border/60 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{run.label}</span>
        <span className="text-muted-foreground text-xs">{run.model}</span>
        {!failed && (
          <>
            <SentimentChip sentiment={run.signals.sentiment} label={t(`sentimentLabel.${run.signals.sentiment}`)} />
            <SignalChip
              ok={run.signals.mentioned}
              label={run.signals.mentioned ? t('mentioned') : t('notMentioned')}
            />
            {run.signals.citedSource && (
              <span className="text-primary border-primary/40 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                <Link2 className="size-3" />
                {t('citedSource')}
              </span>
            )}
          </>
        )}
      </div>
      {failed ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <X className="text-destructive size-4 shrink-0" />
          {t('cellFailed')}
        </p>
      ) : (
        <p className="text-muted-foreground flex gap-2 text-sm leading-relaxed whitespace-pre-wrap">
          <Quote className="mt-0.5 size-4 shrink-0 opacity-50" />
          <span>{run.answer}</span>
        </p>
      )}
    </div>
  );
}

/** Color del chip de sentimiento según su valor. */
function SentimentChip({ sentiment, label }: { sentiment: Sentiment; label: string }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs',
        sentiment === 'positive' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
        sentiment === 'neutral' && 'border-border text-muted-foreground',
        sentiment === 'negative' && 'border-destructive/40 text-destructive',
      )}
    >
      {label}
    </span>
  );
}

/** Chip booleano (mención): tilde si sí, cruz si no. */
function SignalChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        ok ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground',
      )}
    >
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </span>
  );
}
