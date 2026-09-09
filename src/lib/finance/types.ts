import type {
  BillRow,
  CategoryBudgetRow,
  ExpenseRow,
  IncomeRow,
  InvestmentRow,
  OwnerSlot,
  PartnerSlot,
  SavingsContributionRow,
  SavingsGoalWithProgressRow,
} from '@/types/database';

/**
 * Jeu de données brut d'une période, tel que la RLS l'a livré.
 * Toutes les fonctions de `calculations.ts` en dérivent — elles ne font
 * jamais d'appel réseau et restent donc testables sans base.
 */
export interface FinanceDataset {
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  bills: BillRow[];
  contributions: SavingsContributionRow[];
  investments: InvestmentRow[];
  goals: SavingsGoalWithProgressRow[];
  budgets: CategoryBudgetRow[];
}

export function emptyDataset(): FinanceDataset {
  return {
    incomes: [],
    expenses: [],
    bills: [],
    contributions: [],
    investments: [],
    goals: [],
    budgets: [],
  };
}

/** Synthèse d'un mois. Tous les montants sont en euros. */
export interface MonthlyTotals {
  totalIncome: number;
  /** Dépenses hors factures — voir la note de `computeMonthlyTotals`. */
  totalExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  totalBills: number;
  /** Factures du mois non encore réglées. */
  unpaidBills: number;
  /** Somme nette des mouvements d'épargne (retraits déduits). */
  totalSavings: number;
  totalInvested: number;
  /** Sorties d'argent totales : dépenses + factures. */
  totalOutflow: number;
  /** Ce qu'il reste après charges, épargne et investissements. */
  remainingToLive: number;
  /** Revenus − toutes les sorties, épargne et investissements inclus. */
  monthlyBalance: number;
  /** Part des revenus mise de côté, entre 0 et 1. Nul si aucun revenu. */
  savingsRate: number;
  /** Poids des charges fixes (dépenses fixes + factures) sur les revenus. */
  fixedChargeRatio: number;
  /** Dépense moyenne par jour écoulé du mois. */
  dailyAverageExpense: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  /** Part du total, entre 0 et 1. */
  share: number;
  transactionCount: number;
}

export interface OwnerBreakdown {
  owner: OwnerSlot;
  amount: number;
  share: number;
}

export interface ContributionBreakdown {
  slot: PartnerSlot;
  /** Montant réellement décaissé par cette personne (dépenses + factures). */
  paidAmount: number;
  /** Part de la dépense totale du couple, entre 0 et 1. */
  paidShare: number;
  /** Revenus de cette personne sur la période. */
  income: number;
  /** Part des revenus du couple, entre 0 et 1. */
  incomeShare: number;
}

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  /** Clé `YYYY-MM`, utilisée comme identifiant d'axe. */
  key: string;
  label: string;
  income: number;
  expenses: number;
  bills: number;
  savings: number;
  /** Cumul de l'épargne depuis le début de la série. */
  cumulativeSavings: number;
  invested: number;
  cumulativeInvested: number;
  cumulativeValue: number;
  balance: number;
}

export interface Delta {
  /** Variation relative, ou `null` si la référence est nulle. */
  ratio: number | null;
  absolute: number;
}
