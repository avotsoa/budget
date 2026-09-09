import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

interface ProgressBarProps {
  /** Proportion entre 0 et 1 ; les valeurs supérieures sont bornées à 1. */
  value: number;
  label?: string;
  /** Texte aligné à droite du libellé (montant courant / cible). */
  valueLabel?: string;
  /**
   * La couleur de remplissage porte la sévérité pour un budget consommé
   * (bien → attention → dépassement) ; « progress » reste neutre pour un
   * objectif d'épargne, où avancer est toujours favorable.
   */
  tone?: 'progress' | 'severity';
  className?: string;
}

export function ProgressBar({
  value,
  label,
  valueLabel,
  tone = 'progress',
  className,
}: ProgressBarProps) {
  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = ratio * 100;

  // La piste vide est un pas plus clair de la même rampe que le remplissage :
  // l'état se lit sur toute la longueur de la barre.
  const fillColor =
    tone === 'severity'
      ? value > 1
        ? 'var(--status-critical)'
        : value >= 0.85
          ? 'var(--status-warning)'
          : 'var(--brand)'
      : 'var(--brand)';

  return (
    <div className={cn('space-y-1.5', className)}>
      {label || valueLabel ? (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {label ? <span className="truncate text-ink">{label}</span> : <span />}
          {valueLabel ? (
            <span className="shrink-0 tabular-nums text-ink-2">{valueLabel}</span>
          ) : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progression'}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%`, backgroundColor: fillColor }}
        />
      </div>

      <p className="text-xs text-ink-muted">{formatPercent(ratio)}</p>
    </div>
  );
}
