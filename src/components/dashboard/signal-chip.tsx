import { Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Chip booleano (mención): tilde si sí, cruz si no. */
export function SignalChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        ok ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground',
      )}
    >
      {ok ? (
        <Check className="size-3" aria-hidden="true" />
      ) : (
        <X className="size-3" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
