import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currentPeriod, shiftMonth } from '@/lib/format';
import type { ScopeFilter } from '@/lib/constants';

interface ScopeContextValue {
  year: number;
  month: number;
  scope: ScopeFilter;
  setPeriod: (year: number, month: number) => void;
  shiftPeriod: (delta: number) => void;
  goToCurrentMonth: () => void;
  setScope: (scope: ScopeFilter) => void;
  /** Vrai si la période affichée est le mois en cours. */
  isCurrentMonth: boolean;
}

export const ScopeContext = createContext<ScopeContextValue | null>(null);

const SCOPE_VALUES: readonly ScopeFilter[] = ['couple', 'mine', 'shared'];

function isScopeFilter(value: string | null): value is ScopeFilter {
  return value !== null && (SCOPE_VALUES as readonly string[]).includes(value);
}

/**
 * Période et périmètre vivent dans l'URL, pas dans un état local : une vue
 * filtrée reste partageable par lien et survit à un rechargement.
 */
export function ScopeProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const fallback = currentPeriod();

  const parsedYear = Number(searchParams.get('annee'));
  const parsedMonth = Number(searchParams.get('mois'));

  const year = Number.isInteger(parsedYear) && parsedYear > 1970 ? parsedYear : fallback.year;
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : fallback.month;

  const scopeParam = searchParams.get('vue');
  const scope: ScopeFilter = isScopeFilter(scopeParam) ? scopeParam : 'couple';

  const setPeriod = useCallback(
    (nextYear: number, nextMonth: number) => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          next.set('annee', String(nextYear));
          next.set('mois', String(nextMonth));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const shiftPeriod = useCallback(
    (delta: number) => {
      const next = shiftMonth(year, month, delta);
      setPeriod(next.year, next.month);
    },
    [year, month, setPeriod],
  );

  const goToCurrentMonth = useCallback(() => {
    const now = currentPeriod();
    setPeriod(now.year, now.month);
  }, [setPeriod]);

  const setScope = useCallback(
    (nextScope: ScopeFilter) => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          next.set('vue', nextScope);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const value = useMemo<ScopeContextValue>(
    () => ({
      year,
      month,
      scope,
      setPeriod,
      shiftPeriod,
      goToCurrentMonth,
      setScope,
      isCurrentMonth: year === fallback.year && month === fallback.month,
    }),
    [year, month, scope, setPeriod, shiftPeriod, goToCurrentMonth, setScope, fallback.year, fallback.month],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}
