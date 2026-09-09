import type { ReactNode } from 'react';
import { CircleAlert, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** Placeholder de chargement, calé sur la hauteur du contenu qu'il remplace. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-ink-2"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-2">{description}</p>
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  error: Error | string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Impossible de charger les données', error, onRetry }: ErrorStateProps) {
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-critical/10 text-critical">
        <CircleAlert className="h-5 w-5" aria-hidden />
      </div>
      <div className="max-w-md space-y-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-2">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}
