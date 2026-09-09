import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string | undefined;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface shadow-card', className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string | undefined;
  /** Actions alignées à droite du titre (boutons, filtres). */
  action?: ReactNode;
  className?: string | undefined;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
