'use client';

import { AlertTriangle, Link2, Quote, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SentimentChip } from '@/components/dashboard/sentiment-chip';
import { SignalChip } from '@/components/dashboard/signal-chip';
import type { EngineRun } from '@/server/audit/types';

/** Respuesta textual de un motor para un prompt, con sus señales o su estado de error. */
export function EngineAnswer({ run }: { run: EngineRun }) {
  const t = useTranslations('Audit.dashboard');
  const hasAnswer = run.answer.trim().length > 0;
  // El motor no respondió (falló o devolvió vacío): no hay nada que mostrar.
  const engineFailed = !hasAnswer;
  // El motor SÍ respondió, pero nuestro juez no pudo analizar la celda. Mostramos la respuesta
  // (honestidad: el motor no falló) y avisamos que el análisis no está disponible, sin señales.
  const analysisUnavailable = hasAnswer && Boolean(run.error);

  return (
    <div className="border-border/60 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{run.label}</span>
        <span className="text-muted-foreground text-xs">{run.model}</span>
        {!engineFailed && !analysisUnavailable && (
          <>
            <SentimentChip
              sentiment={run.signals.sentiment}
              label={t(`sentimentLabel.${run.signals.sentiment}`)}
            />
            <SignalChip
              ok={run.signals.mentioned}
              label={run.signals.mentioned ? t('mentioned') : t('notMentioned')}
            />
            {run.signals.citedSource && (
              <span className="text-primary border-primary/40 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                <Link2 className="size-3" aria-hidden="true" />
                {t('citedSource')}
              </span>
            )}
          </>
        )}
      </div>
      {engineFailed ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <X className="text-destructive size-4 shrink-0" aria-hidden="true" />
          {t('cellFailed')}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground flex gap-2 text-sm leading-relaxed whitespace-pre-wrap">
            <Quote className="mt-0.5 size-4 shrink-0 opacity-50" aria-hidden="true" />
            <span>{run.answer}</span>
          </p>
          {analysisUnavailable && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              {t('analysisUnavailable')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
