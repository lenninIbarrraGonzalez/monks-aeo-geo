import { barColor } from '@/lib/audit-report';
import { cn } from '@/lib/utils';

/** Barra de progreso 0–100 con color por tramo (patrón compartido del reporte). */
export function ScoreBar({ value }: { value: number }) {
  return (
    <div
      className="bg-muted h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all', barColor(value))}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
