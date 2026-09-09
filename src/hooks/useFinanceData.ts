import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { lastNMonths, shiftMonth } from '@/lib/format';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import {
  computeCategoryBreakdown,
  computeContributions,
  computeDelta,
  computeMonthlyTotals,
  computeMonthlyTrend,
  computePortfolio,
  computeSavingsOverview,
  periodDataset,
  scopeDataset,
} from '@/lib/finance/calculations';
import { evaluateAlerts } from '@/lib/finance/alerts';
import { emptyDataset, type FinanceDataset } from '@/lib/finance/types';
import type {
  BillRow,
  CategoryBudgetRow,
  ExpenseRow,
  IncomeRow,
  InvestmentRow,
  SavingsContributionRow,
  SavingsGoalWithProgressRow,
} from '@/types/database';

/** Profondeur d'historique chargée, en mois — dimensionne les graphiques. */
export const TREND_MONTHS = 12;

export const financeQueryKey = ['finance'] as const;

/**
 * Charge en une fois tout l'historique visible du foyer.
 *
 * Un chargement global plutôt qu'une requête par mois : le volume reste
 * modeste (quelques centaines de lignes par an), et toutes les vues —
 * dashboard, rapports, comparaison au mois précédent — travaillent alors sur
 * la même source en mémoire, sans requête supplémentaire au changement de mois.
 */
async function fetchFinanceData(householdId: string, since: string): Promise<FinanceDataset> {
  const [incomes, expenses, bills, contributions, investments, goals, budgets] = await Promise.all([
    supabase.from('incomes').select('*').eq('household_id', householdId).is('deleted_at', null).gte('date', since),
    supabase.from('expenses').select('*').eq('household_id', householdId).is('deleted_at', null).gte('date', since),
    supabase.from('bills').select('*').eq('household_id', householdId).is('deleted_at', null).gte('date', since),
    supabase.from('savings_contributions').select('*').eq('household_id', householdId).is('deleted_at', null).gte('date', since),
    supabase.from('investments').select('*').eq('household_id', householdId).is('deleted_at', null).gte('date', since),
    supabase.from('savings_goals_with_progress').select('*').eq('household_id', householdId),
    supabase.from('category_budgets').select('*').eq('household_id', householdId).is('deleted_at', null),
  ]);

  const failed = [incomes, expenses, bills, contributions, investments, goals, budgets].find(
    (result) => result.error,
  );
  if (failed?.error) throw failed.error;

  return {
    incomes: (incomes.data ?? []) as IncomeRow[],
    expenses: (expenses.data ?? []) as ExpenseRow[],
    bills: (bills.data ?? []) as BillRow[],
    contributions: (contributions.data ?? []) as SavingsContributionRow[],
    investments: (investments.data ?? []) as InvestmentRow[],
    goals: (goals.data ?? []) as SavingsGoalWithProgressRow[],
    budgets: (budgets.data ?? []) as CategoryBudgetRow[],
  };
}

/**
 * Source unique de vérité des pages : données brutes, jeu filtré par périmètre
 * et période, totaux, tendances et alertes — tout dérivé en mémoire.
 */
export function useFinanceData() {
  const { household, mySlot } = useHousehold();
  const { year, month, scope } = useScope();

  const since = useMemo(() => {
    const start = shiftMonth(year, month, -(TREND_MONTHS - 1));
    return `${start.year}-${String(start.month).padStart(2, '0')}-01`;
  }, [year, month]);

  const query = useQuery({
    queryKey: [...financeQueryKey, household?.id, since],
    queryFn: () => fetchFinanceData(household?.id as string, since),
    enabled: Boolean(household?.id),
    staleTime: 15_000,
  });

  const raw = query.data ?? emptyDataset();

  return useMemo(() => {
    // Périmètre d'abord : tout ce qui suit doit refléter la vue choisie.
    const scoped = scopeDataset(raw, scope, mySlot);

    const current = periodDataset(scoped, year, month);
    const previousPeriod = shiftMonth(year, month, -1);
    const previous = periodDataset(scoped, previousPeriod.year, previousPeriod.month);

    const totals = computeMonthlyTotals(current, year, month);
    const previousTotals = computeMonthlyTotals(
      previous,
      previousPeriod.year,
      previousPeriod.month,
    );

    const trend = computeMonthlyTrend(scoped, lastNMonths(year, month, TREND_MONTHS));

    const alerts = evaluateAlerts({
      dataset: current,
      totals,
      previousSavings: previousTotals.totalSavings,
      year,
      month,
    });

    return {
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      error: (query.error as Error | null) ?? null,
      refetch: query.refetch,

      /** Tout l'historique, avant filtrage de période. */
      scoped,
      /** Le mois affiché. */
      current,
      previous,

      totals,
      previousTotals,
      deltas: {
        income: computeDelta(totals.totalIncome, previousTotals.totalIncome),
        expenses: computeDelta(totals.totalExpenses, previousTotals.totalExpenses),
        bills: computeDelta(totals.totalBills, previousTotals.totalBills),
        savings: computeDelta(totals.totalSavings, previousTotals.totalSavings),
        investments: computeDelta(totals.totalInvested, previousTotals.totalInvested),
        balance: computeDelta(totals.monthlyBalance, previousTotals.monthlyBalance),
        savingsRate: computeDelta(totals.savingsRate, previousTotals.savingsRate),
        remaining: computeDelta(totals.remainingToLive, previousTotals.remainingToLive),
      },

      trend,
      categories: computeCategoryBreakdown(current),
      contributions: computeContributions(current),
      portfolio: computePortfolio(scoped),
      savingsOverview: computeSavingsOverview(scoped),
      alerts,
    };
  }, [raw, scope, mySlot, year, month, query.isLoading, query.isFetching, query.error, query.refetch]);
}
