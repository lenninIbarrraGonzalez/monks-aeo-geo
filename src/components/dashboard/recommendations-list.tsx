'use client';

import { useTranslations } from 'next-intl';

import { deriveRecommendations } from '@/lib/audit-report';
import { cn } from '@/lib/utils';
import type { AuditResult } from '@/server/audit/types';

/**
 * Lista de recomendaciones AEO/GEO derivadas del score. Si no hay debilidades por debajo del
 * umbral, muestra un mensaje positivo en vez de una lista vacía.
 */
export function RecommendationsList({ score }: { score: AuditResult['score'] }) {
  const t = useTranslations('Audit.dashboard');
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
}
