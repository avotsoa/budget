import { Users, User, Handshake } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SCOPE_DESCRIPTIONS, SCOPE_LABELS, type ScopeFilter } from '@/lib/constants';
import { useScope } from '@/hooks/useScope';

const OPTIONS: Array<{ value: ScopeFilter; icon: ReactNode; short: string }> = [
  { value: 'couple', icon: <Users className="h-3.5 w-3.5" aria-hidden />, short: 'Couple' },
  { value: 'mine', icon: <User className="h-3.5 w-3.5" aria-hidden />, short: 'Moi' },
  { value: 'shared', icon: <Handshake className="h-3.5 w-3.5" aria-hidden />, short: 'Commun' },
];

/**
 * Périmètre de lecture appliqué à toutes les pages.
 *
 * Filtre de confort, pas de sécurité : les données privées du partenaire ne
 * sont jamais parvenues au navigateur, la RLS les ayant déjà écartées.
 */
export function ScopeSwitcher() {
  const { scope, setScope } = useScope();

  return (
    <div
      role="radiogroup"
      aria-label="Périmètre des données"
      className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-1"
    >
      {OPTIONS.map((option) => {
        const isActive = scope === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={SCOPE_DESCRIPTIONS[option.value]}
            onClick={() => setScope(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-brand text-brand-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            {option.icon}
            <span className="hidden sm:inline">{option.short}</span>
            <span className="sr-only">{SCOPE_LABELS[option.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
