'use client';

import { useTranslations } from 'next-intl';

import { ScoreBar } from '@/components/dashboard/score-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deriveCompetitive } from '@/lib/audit-report';
import type { AuditResult } from '@/server/audit/types';

/** Sección de posicionamiento competitivo, con estado vacío honesto si no hubo comparación. */
export function CompetitiveSection({
  result,
  delay,
}: {
  result: AuditResult;
  delay?: React.CSSProperties;
}) {
  const t = useTranslations('Audit.dashboard');
  const competitive = deriveCompetitive(result);
  const score = Math.round(result.score.dimensions.competitive);

  return (
    <Card className="animate-fade-in" style={delay}>
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
                <span
                  key={competitor}
                  className="border-border rounded-full border px-2 py-0.5 text-xs"
                >
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
