import { cn } from '@/lib/utils';
import type { Sentiment } from '@/server/audit/types';

/** Color del chip de sentimiento según su valor. */
export function SentimentChip({ sentiment, label }: { sentiment: Sentiment; label: string }) {
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
