import type { ReactNode } from 'react';
import { AlertTriangle, Check, CircleAlert, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AlertLevel, BillStatus, OwnerSlot } from '@/types/database';
import { BILL_STATUS_LABELS, OWNER_SERIES_SLOT } from '@/lib/constants';

type Tone = 'neutral' | 'good' | 'warning' | 'critical' | 'brand';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  good: 'bg-good/10 text-good border-good/30',
  warning: 'bg-warning/15 text-ink border-warning/40',
  critical: 'bg-critical/10 text-critical border-critical/30',
  brand: 'bg-brand/10 text-brand border-brand/30',
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const BILL_STATUS_TONES: Record<BillStatus, Tone> = {
  paid: 'good',
  pending: 'neutral',
  overdue: 'critical',
};

/**
 * Statut de facture. L'icône double la couleur : un statut ne doit jamais
 * reposer sur la teinte seule.
 */
export function BillStatusBadge({ status }: { status: BillStatus }) {
  const icons: Record<BillStatus, ReactNode> = {
    paid: <Check className="h-3 w-3" aria-hidden />,
    pending: <Info className="h-3 w-3" aria-hidden />,
    overdue: <AlertTriangle className="h-3 w-3" aria-hidden />,
  };

  return (
    <Badge tone={BILL_STATUS_TONES[status]} icon={icons[status]}>
      {BILL_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Pastille de propriétaire. La couleur suit la place occupée, pas le rang
 * d'affichage : elle reste stable quel que soit le filtre appliqué.
 */
export function OwnerBadge({ owner, label }: { owner: OwnerSlot; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-2">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: `var(--series-${OWNER_SERIES_SLOT[owner]})` }}
      />
      {label}
    </span>
  );
}

const ALERT_TONES: Record<AlertLevel, Tone> = {
  info: 'brand',
  warning: 'warning',
  critical: 'critical',
};

const ALERT_LABELS: Record<AlertLevel, string> = {
  info: 'Information',
  warning: 'Attention',
  critical: 'Urgent',
};

export function AlertBadge({ level }: { level: AlertLevel }) {
  const icons: Record<AlertLevel, ReactNode> = {
    info: <Info className="h-3 w-3" aria-hidden />,
    warning: <AlertTriangle className="h-3 w-3" aria-hidden />,
    critical: <CircleAlert className="h-3 w-3" aria-hidden />,
  };

  return (
    <Badge tone={ALERT_TONES[level]} icon={icons[level]}>
      {ALERT_LABELS[level]}
    </Badge>
  );
}
