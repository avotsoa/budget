import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase, toErrorMessage } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { financeQueryKey } from '@/hooks/useFinanceData';

/** Tables sur lesquelles l'application écrit. */
export type FinanceTable =
  | 'incomes'
  | 'expenses'
  | 'bills'
  | 'savings_goals'
  | 'savings_contributions'
  | 'investments'
  | 'category_budgets';

/** Genre porté explicitement : le déduire du libellé donnerait de faux accords. */
const ENTITY_LABELS: Record<FinanceTable, { noun: string; feminine: boolean }> = {
  incomes: { noun: 'Revenu', feminine: false },
  expenses: { noun: 'Dépense', feminine: true },
  bills: { noun: 'Facture', feminine: true },
  savings_goals: { noun: 'Objectif', feminine: false },
  savings_contributions: { noun: 'Versement', feminine: false },
  investments: { noun: 'Investissement', feminine: false },
  category_budgets: { noun: 'Budget', feminine: false },
};

/**
 * Charge utile d'un formulaire.
 *
 * Volontairement non typée par table : chaque formulaire valide déjà sa forme
 * avec zod, et c'est la RLS qui a le dernier mot côté serveur. Un générique par
 * table n'ajouterait qu'une friction de typage sans garantie supplémentaire.
 */
type FinanceValues = Record<string, unknown>;

type Action = 'ajouté' | 'modifié' | 'supprimé';

function confirmationMessage(table: FinanceTable, action: Action): string {
  const { noun, feminine } = ENTITY_LABELS[table];
  return `${noun} ${action}${feminine ? 'e' : ''}`;
}

/**
 * CRUD générique sur une table financière.
 *
 * `household_id` et `created_by` sont posés ici et jamais par l'appelant :
 * la policy d'insertion exige `created_by = auth.uid()`, autant que ce soit
 * une garantie du code plutôt qu'une discipline de chaque formulaire.
 *
 * La suppression est logique (`deleted_at`), conformément au schéma.
 */
export function useFinanceMutations(table: FinanceTable) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { household } = useHousehold();

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: financeQueryKey });
  }, [queryClient]);

  const create = useMutation({
    mutationFn: async (values: FinanceValues) => {
      if (!household || !user) throw new Error('Aucun foyer actif');

      const { error } = await supabase
        .from(table)
        .insert({ ...values, household_id: household.id, created_by: user.id });

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(confirmationMessage(table, 'ajouté'));
      await invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FinanceValues }) => {
      const { error } = await supabase.from(table).update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(confirmationMessage(table, 'modifié'));
      await invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Suppression logique : l'historique reste auditable et le temps réel
      // propage un UPDATE, que les deux clients savent traiter.
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(confirmationMessage(table, 'supprimé'));
      await invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  });

  return useMemo(
    () => ({
      create,
      update,
      remove,
      isPending: create.isPending || update.isPending || remove.isPending,
    }),
    [create, update, remove],
  );
}
