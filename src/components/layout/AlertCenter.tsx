import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { AlertBadge } from '@/components/ui/Badge';
import { summarizeAlerts, type FinanceAlert } from '@/lib/finance/alerts';
import { useAlertInbox } from '@/hooks/useAlertInbox';

interface AlertCenterProps {
  /** Alertes calculées pour la période affichée, avant filtrage des rejets. */
  alerts: FinanceAlert[];
}

export function AlertCenter({ alerts: allAlerts }: AlertCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { visibleAlerts: alerts, dismissedCount, onDismiss, onRestoreAll } =
    useAlertInbox(allAlerts);
  const summary = summarizeAlerts(alerts);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={
          summary.total > 0 ? `Alertes : ${summary.total} en cours` : 'Alertes : aucune en cours'
        }
        className="relative"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {summary.total > 0 ? (
          <span
            aria-hidden
            className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center',
              'rounded-full px-1 text-[10px] font-semibold text-white',
              summary.critical > 0 ? 'bg-critical' : 'bg-warning text-ink',
            )}
          >
            {summary.total}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Centre d’alertes"
          className={cn(
            'absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))]',
            'rounded-xl border border-line bg-surface shadow-pop',
          )}
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Alertes</p>
            <p className="text-xs text-ink-2">
              {summary.total === 0
                ? 'Tout est sous contrôle ce mois-ci.'
                : `${summary.critical} urgente(s), ${summary.warning} à surveiller.`}
            </p>
          </div>

          <div className="scrollbar-slim max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-good" aria-hidden />
                <p className="text-sm text-ink-2">
                  {dismissedCount > 0
                    ? 'Toutes les alertes de la période ont été masquées.'
                    : 'Aucune alerte pour la période affichée.'}
                </p>
              </div>
            ) : (
              <ul>
                {alerts.map((alert) => (
                  <li
                    key={alert.dedupeKey}
                    className="flex items-start gap-1 border-b border-line last:border-0"
                  >
                    <Link
                      to={alert.href}
                      onClick={() => setIsOpen(false)}
                      className="min-w-0 flex-1 px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{alert.title}</p>
                        <AlertBadge level={alert.severity} />
                      </div>
                      <p className="mt-1 text-sm text-ink-2">{alert.body}</p>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mr-1 mt-2 shrink-0"
                      onClick={() => onDismiss(alert.dedupeKey)}
                      aria-label={`Masquer l’alerte : ${alert.title}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {dismissedCount > 0 ? (
            <div className="border-t border-line px-4 py-2">
              <button
                type="button"
                onClick={onRestoreAll}
                className="text-xs text-ink-2 transition-colors hover:text-ink"
              >
                Réafficher {dismissedCount} alerte(s) masquée(s)
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
