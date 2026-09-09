import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { financeQueryKey } from '@/hooks/useFinanceData';
import { householdQueryKey } from '@/contexts/HouseholdContext';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';

/** Tables écoutées, avec le libellé annoncé quand la modification vient de l'autre. */
const WATCHED_TABLES: Array<{ table: string; label: string }> = [
  { table: 'incomes', label: 'Revenus' },
  { table: 'expenses', label: 'Dépenses' },
  { table: 'bills', label: 'Factures' },
  { table: 'savings_goals', label: 'Épargne' },
  { table: 'savings_contributions', label: 'Épargne' },
  { table: 'investments', label: 'Investissements' },
  { table: 'category_budgets', label: 'Budgets' },
];

export type RealtimeStatus = 'connecting' | 'live' | 'error' | 'idle';

/**
 * Synchronisation quasi temps réel entre les deux partenaires.
 *
 * Un seul canal filtré sur `household_id` porte toutes les tables. Chaque
 * événement invalide le cache TanStack Query, qui refait une lecture : le
 * client ne reconstruit jamais l'état à partir de la charge utile, donc la RLS
 * reste seule juge de ce qui est visible.
 *
 * Cette même RLS s'applique à la diffusion : les lignes privées de l'autre
 * partenaire ne déclenchent aucun événement ici.
 */
export function useRealtimeSync(): RealtimeStatus {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { household } = useHousehold();
  const [status, setStatus] = useState<RealtimeStatus>('idle');

  // Évite de notifier l'utilisateur de ses propres écritures : la mutation a
  // déjà affiché sa confirmation.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    const householdId = household?.id;
    if (!householdId) {
      setStatus('idle');
      return;
    }

    setStatus('connecting');

    const channel = supabase.channel(`household:${householdId}`, {
      config: { private: false },
    });

    for (const { table, label } of WATCHED_TABLES) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as { created_by?: string } | null;
          const isMine = record?.created_by === userIdRef.current;

          void queryClient.invalidateQueries({ queryKey: financeQueryKey });

          if (!isMine) {
            toast.info(`${label} mis à jour par votre partenaire`, { duration: 3000 });
          }
        },
      );
    }

    // L'arrivée du second partenaire change la composition du foyer :
    // les noms affichés et les places doivent se rafraîchir aussitôt.
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: householdQueryKey });
      },
    );

    channel.subscribe((subscriptionStatus) => {
      switch (subscriptionStatus) {
        case 'SUBSCRIBED':
          setStatus('live');
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          setStatus('error');
          break;
        case 'CLOSED':
          setStatus('idle');
          break;
        default:
          setStatus('connecting');
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [household?.id, queryClient]);

  return status;
}
