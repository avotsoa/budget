import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { financeQueryKey } from '@/hooks/useFinanceData';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import type { HouseholdTotalsRow } from '@/types/database';

/**
 * Totaux du foyer entier, parts privées des deux partenaires comprises.
 *
 * Impossible à calculer côté client : la RLS retire les lignes privées du
 * partenaire avant qu'elles n'atteignent le navigateur. Seule une fonction
 * `security definer` peut les additionner, et elle ne renvoie que des sommes.
 */
async function fetchHouseholdTotals(year: number, month: number): Promise<HouseholdTotalsRow> {
  const { data, error } = await supabase.rpc('household_totals', {
    p_year: year,
    p_month: month,
  });

  if (error) throw error;

  // La fonction renvoie une table d'une seule ligne ; PostgREST l'expose
  // donc sous forme de tableau.
  const row = (data as HouseholdTotalsRow[] | null)?.[0];
  if (!row) throw new Error('Totaux du foyer indisponibles');

  return row;
}

export function useHouseholdTotals() {
  const { household } = useHousehold();
  const { year, month } = useScope();

  const query = useQuery({
    // Préfixé par `financeQueryKey` : useRealtimeSync invalide par préfixe,
    // ces totaux se rafraîchissent donc avec le reste.
    queryKey: [...financeQueryKey, 'household-totals', household?.id, year, month],
    queryFn: () => fetchHouseholdTotals(year, month),
    enabled: Boolean(household?.id),
    staleTime: 15_000,
    // Le temps réel ne suffit pas ici : la RLS s'applique aussi à la
    // diffusion, donc l'ajout d'une ligne PRIVÉE par le partenaire n'émet
    // aucun événement de notre côté. Sans ce rappel périodique, le total
    // resterait figé alors qu'il a changé.
    refetchInterval: 60_000,
  });

  return {
    totals: query.data ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
