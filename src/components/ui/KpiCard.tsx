import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatSignedPercent } from '@/lib/format';
import type { Delta } from '@/lib/finance/types';
import { Skeleton } from './States';

interface KpiCardProps {
  label: string;
  value: string;
  delta?: Delta | undefined;
  /**
   * Sens « favorable » de la variation. Une hausse des dépenses est mauvaise,
   * une hausse de l'épargne est bonne : la couleur suit le sens métier, pas le signe.
   */
  deltaDirection?: 'up-is-good' | 'down-is-good' | 'neutral';
  hint?: string | undefined;
  icon?: ReactNode;
  isLoading?: boolean;
  /** Met en avant une carte de synthèse parmi les autres. */
  emphasis?: boolean;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaDirection = 'up-is-good',
  hint,
  icon,
  isLoading = false,
  emphasis = false,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface p-4 shadow-card transition-colors',
        emphasis ? 'border-brand/40' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ink-2">{label}</p>
        {icon ? <span className="shrink-0 text-ink-muted">{icon}</span> : null}
      </div>

      {isLoading ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        // Chiffres proportionnels : `tabular-nums` desserre les grands nombres
        // isolés. L'alignement vertical ne concerne que les colonnes de tableau.
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {delta ? <DeltaIndicator delta={delta} direction={deltaDirection} /> : null}
        {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

function DeltaIndicator({
  delta,
  direction,
}: {
  delta: Delta;
  direction: 'up-is-good' | 'down-is-good' | 'neutral';
}) {
  if (delta.ratio === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
        <Minus className="h-3 w-3" aria-hidden />
        Pas de référence
      </span>
    );
  }

  const isFlat = Math.abs(delta.ratio) < 0.005;
  const isUp = delta.ratio > 0;

  const isGood =
    direction === 'neutral' ? null : direction === 'up-is-good' ? isUp : !isUp;

  const colorClass =
    isFlat || isGood === null ? 'text-ink-muted' : isGood ? 'text-delta-up' : 'text-delta-down';

  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', colorClass)}>
      <Icon className="h-3 w-3" aria-hidden />
      {formatSignedPercent(delta.ratio)}
      <span className="font-normal text-ink-muted"> vs mois précédent</span>
    </span>
  );
}
