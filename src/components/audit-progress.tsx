'use client';

import { Check, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuditStreamState } from '@/hooks/use-audit-stream';
import { cn } from '@/lib/utils';
import type { EngineId } from '@/types/engine';

/** Nombre legible de cada motor para etiquetar las celdas en vivo (honestidad: nunca atribuir mal). */
const ENGINE_LABELS: Record<EngineId, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const STEPS = ['profile', 'prompts', 'answers', 'judge', 'score'] as const;

interface AuditProgressProps {
  state: AuditStreamState;
  /** Cancela la auditoría en curso y vuelve al inicio. */
  onCancel: () => void;
}

/** Vista de progreso en vivo: stepper de fases + perfil detectado + matriz prompt × motor. */
export function AuditProgress({ state, onCancel }: AuditProgressProps) {
  const t = useTranslations('Audit.progress');
  const { profile, prompts, answers, judged } = state;

  const milestone = currentMilestone(state);

  // Motores observados hasta ahora (las columnas aparecen a medida que cada motor responde).
  const engines = Array.from(
    new Set(Object.values(answers).flatMap((byEngine) => Object.keys(byEngine))),
  ).sort() as EngineId[];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('title', { brand: state.brand })}
        </h2>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      {/* Stepper de fases */}
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map((step, index) => {
          const position = index + 1;
          const status =
            milestone > position ? 'done' : milestone === position ? 'active' : 'pending';
          return (
            <li key={step} className="flex flex-1 flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border text-sm font-medium transition-colors sm:size-8',
                  status === 'done' && 'border-primary bg-primary text-primary-foreground',
                  status === 'active' &&
                    'border-primary text-primary animate-pulse-soft bg-transparent',
                  status === 'pending' && 'border-border text-muted-foreground',
                )}
              >
                {status === 'done' ? <Check className="size-4" aria-hidden="true" /> : position}
              </span>
              <span
                className={cn(
                  'text-[10px] leading-tight sm:text-xs',
                  status === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {t(`steps.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Zona dinámica: lectores de pantalla anuncian la llegada de perfil/respuestas en vivo. */}
      <div className="flex flex-col gap-6" aria-live="polite">
        {/* Perfil detectado */}
        {profile && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-base">{t('profileTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{profile.description}</p>
              <div className="flex flex-col gap-1">
                <span>
                  <span className="text-muted-foreground">{t('profileCategory')}: </span>
                  {profile.category}
                </span>
                {profile.competitors.length > 0 && (
                  <span>
                    <span className="text-muted-foreground">{t('profileCompetitors')}: </span>
                    {profile.competitors.join(', ')}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {t('profileBy', {
                  engine: ENGINE_LABELS[profile.detectedBy] ?? profile.detectedBy,
                })}
              </span>
            </CardContent>
          </Card>
        )}

        {/* Matriz prompt × motor */}
        {prompts.length > 0 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-base">{t('promptsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {prompts.map((prompt) => (
                <div key={prompt.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm">{prompt.text}</p>
                    {judged[prompt.id] && (
                      <span className="text-primary shrink-0 text-xs font-medium">
                        {t('statusJudged')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs">
                      {t(`intent.${prompt.intent}`)}
                    </span>
                    {engines.map((engineId) => (
                      <EngineChip
                        key={engineId}
                        label={ENGINE_LABELS[engineId] ?? engineId}
                        ok={answers[prompt.id]?.[engineId]}
                        pendingLabel={t('statusPending')}
                        okLabel={t('statusOk')}
                        failedLabel={t('statusFailed')}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-center">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </section>
  );
}

interface EngineChipProps {
  label: string;
  /** `undefined` = aún pendiente; `true` = respondió; `false` = falló en esta celda. */
  ok: boolean | undefined;
  pendingLabel: string;
  okLabel: string;
  failedLabel: string;
}

/** Chip de estado de un motor para un prompt: pendiente / respondió / falló, con el motor etiquetado. */
function EngineChip({ label, ok, pendingLabel, okLabel, failedLabel }: EngineChipProps) {
  const status = ok === undefined ? 'pending' : ok ? 'ok' : 'failed';
  const statusLabel = status === 'pending' ? pendingLabel : status === 'ok' ? okLabel : failedLabel;

  return (
    <span
      title={`${label}: ${statusLabel}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        status === 'ok' && 'border-primary/40 text-primary',
        status === 'failed' && 'border-destructive/40 text-destructive',
        status === 'pending' && 'border-border text-muted-foreground',
      )}
    >
      {status === 'pending' && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
      {status === 'ok' && <Check className="size-3" aria-hidden="true" />}
      {status === 'failed' && <X className="size-3" aria-hidden="true" />}
      {label}
    </span>
  );
}

/** Hito más avanzado alcanzado (1–5), para iluminar el stepper de fases. */
function currentMilestone(state: AuditStreamState): number {
  if (state.score) return 5;
  if (Object.keys(state.judged).length > 0) return 4;
  if (Object.keys(state.answers).length > 0) return 3;
  if (state.prompts.length > 0) return 2;
  if (state.profile) return 1;
  return 0;
}
