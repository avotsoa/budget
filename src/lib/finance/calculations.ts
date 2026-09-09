/**
 * Logique financière — fonctions pures, sans dépendance réseau ni React.
 *
 * Convention appliquée partout : « dépenses » et « factures » sont deux flux
 * distincts qui ne se recouvrent jamais. Une facture récurrente vit dans
 * `bills`, une transaction ponctuelle dans `expenses`. Les additionner donne
 * les sorties totales ; les confondre les compterait deux fois.
 */

import { formatMonthShort, monthKey } from '@/lib/format';
import type { ScopeFilter } from '@/lib/constants';
import type { OwnerSlot, PartnerSlot } from '@/types/database';
import type {
  CategoryBreakdown,
  ContributionBreakdown,
  Delta,
  FinanceDataset,
  MonthlyTotals,
  MonthlyTrendPoint,
  OwnerBreakdown,
} from './types';

/** Arrondi comptable au centime — évite les 0.30000000000000004 dans les totaux. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}

interface HasOwner {
  owner: OwnerSlot;
}

interface HasPeriod {
  year: number;
  month: number;
}

/**
 * Filtre de périmètre appliqué côté client.
 *
 * Ce n'est pas une mesure de sécurité : la RLS a déjà retiré les données
 * privées de l'autre partenaire. C'est un filtre de lecture qui permet à
 * l'utilisateur de restreindre sa propre vue.
 */
export function filterByScope<T extends HasOwner>(
  records: T[],
  scope: ScopeFilter,
  mySlot: PartnerSlot | null,
): T[] {
  switch (scope) {
    case 'mine':
      return mySlot ? records.filter((record) => record.owner === mySlot) : [];
    case 'shared':
      return records.filter((record) => record.owner === 'shared');
    case 'couple':
      return records;
  }
}

export function filterByPeriod<T extends HasPeriod>(
  records: T[],
  year: number,
  month: number,
): T[] {
  return records.filter((record) => record.year === year && record.month === month);
}

/** Applique périmètre puis période à l'ensemble du jeu de données. */
export function scopeDataset(
  dataset: FinanceDataset,
  scope: ScopeFilter,
  mySlot: PartnerSlot | null,
): FinanceDataset {
  return {
    incomes: filterByScope(dataset.incomes, scope, mySlot),
    expenses: filterByScope(dataset.expenses, scope, mySlot),
    bills: filterByScope(dataset.bills, scope, mySlot),
    contributions: filterByScope(dataset.contributions, scope, mySlot),
    investments: filterByScope(dataset.investments, scope, mySlot),
    goals: filterByScope(dataset.goals, scope, mySlot),
    budgets: filterByScope(dataset.budgets, scope, mySlot),
  };
}

export function periodDataset(
  dataset: FinanceDataset,
  year: number,
  month: number,
): FinanceDataset {
  return {
    incomes: filterByPeriod(dataset.incomes, year, month),
    expenses: filterByPeriod(dataset.expenses, year, month),
    bills: filterByPeriod(dataset.bills, year, month),
    contributions: filterByPeriod(dataset.contributions, year, month),
    investments: filterByPeriod(dataset.investments, year, month),
    goals: dataset.goals, // un objectif n'appartient pas à un mois
    budgets: dataset.budgets, // un plafond est valable tous les mois
  };
}

/**
 * Nombre de jours à considérer pour une moyenne journalière.
 * Sur le mois en cours on s'arrête à aujourd'hui, sinon la moyenne serait
 * artificiellement basse en début de mois.
 */
export function elapsedDaysInMonth(year: number, month: number, today = new Date()): number {
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  if (isCurrentMonth) return today.getDate();

  const isFuture = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);
  if (isFuture) return 0;

  return new Date(year, month, 0).getDate();
}

/**
 * Agrégats d'une période. `dataset` doit déjà être filtré sur le mois voulu
 * (voir `periodDataset`).
 */
export function computeMonthlyTotals(
  dataset: FinanceDataset,
  year: number,
  month: number,
  today = new Date(),
): MonthlyTotals {
  const totalIncome = sum(dataset.incomes.map((income) => Number(income.amount)));

  const fixedExpenses = sum(
    dataset.expenses.filter((expense) => expense.kind === 'fixed').map((e) => Number(e.amount)),
  );
  const variableExpenses = sum(
    dataset.expenses.filter((expense) => expense.kind === 'variable').map((e) => Number(e.amount)),
  );
  const totalExpenses = round2(fixedExpenses + variableExpenses);

  const totalBills = sum(dataset.bills.map((bill) => Number(bill.amount)));
  const unpaidBills = sum(
    dataset.bills.filter((bill) => bill.status !== 'paid').map((bill) => Number(bill.amount)),
  );

  const totalSavings = sum(dataset.contributions.map((c) => Number(c.amount)));
  const totalInvested = sum(dataset.investments.map((i) => Number(i.invested_amount)));

  const totalOutflow = round2(totalExpenses + totalBills);
  const remainingToLive = round2(totalIncome - totalOutflow - totalSavings - totalInvested);

  const elapsedDays = elapsedDaysInMonth(year, month, today);

  return {
    totalIncome,
    totalExpenses,
    fixedExpenses,
    variableExpenses,
    totalBills,
    unpaidBills,
    totalSavings,
    totalInvested,
    totalOutflow,
    remainingToLive,
    // Identique à `remainingToLive` par construction, mais les deux notions sont
    // distinctes dans l'esprit de l'utilisateur : ce qui reste à dépenser
    // d'une part, le résultat du mois d'autre part.
    monthlyBalance: remainingToLive,
    savingsRate: totalIncome > 0 ? round2(totalSavings / totalIncome * 100) / 100 : 0,
    fixedChargeRatio:
      totalIncome > 0 ? round2((fixedExpenses + totalBills) / totalIncome * 100) / 100 : 0,
    dailyAverageExpense: elapsedDays > 0 ? round2(totalExpenses / elapsedDays) : 0,
  };
}

/** Variation d'une valeur par rapport à sa référence. */
export function computeDelta(current: number, previous: number): Delta {
  const absolute = round2(current - previous);
  if (previous === 0) {
    return { ratio: null, absolute };
  }
  return { ratio: round2((current - previous) / Math.abs(previous) * 100) / 100, absolute };
}

/** Répartition des dépenses par catégorie, de la plus lourde à la plus légère. */
export function computeCategoryBreakdown(dataset: FinanceDataset): CategoryBreakdown[] {
  const totals = new Map<string, { amount: number; count: number }>();

  for (const expense of dataset.expenses) {
    const entry = totals.get(expense.category) ?? { amount: 0, count: 0 };
    entry.amount += Number(expense.amount);
    entry.count += 1;
    totals.set(expense.category, entry);
  }

  const grandTotal = Array.from(totals.values()).reduce((acc, entry) => acc + entry.amount, 0);

  return Array.from(totals.entries())
    .map(([category, entry]) => ({
      category,
      amount: round2(entry.amount),
      share: grandTotal > 0 ? entry.amount / grandTotal : 0,
      transactionCount: entry.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Limite le nombre de tranches d'un camembert : au-delà de huit séries, une
 * neuvième couleur n'existe pas — le reste est regroupé dans « Autres ».
 */
export function capCategories(
  breakdown: CategoryBreakdown[],
  maxSlices: number,
): CategoryBreakdown[] {
  if (breakdown.length <= maxSlices) return breakdown;

  const kept = breakdown.slice(0, maxSlices - 1);
  const rest = breakdown.slice(maxSlices - 1);

  const restAmount = round2(rest.reduce((total, item) => total + item.amount, 0));

  return [
    ...kept,
    {
      category: 'Autres',
      amount: restAmount,
      share: rest.reduce((total, item) => total + item.share, 0),
      transactionCount: rest.reduce((total, item) => total + item.transactionCount, 0),
    },
  ];
}

/** Répartition d'un flux par propriétaire (partnerA / partnerB / commun). */
export function computeOwnerBreakdown(
  records: Array<{ owner: OwnerSlot; amount: number | string }>,
): OwnerBreakdown[] {
  const totals = new Map<OwnerSlot, number>();

  for (const record of records) {
    totals.set(record.owner, (totals.get(record.owner) ?? 0) + Number(record.amount));
  }

  const grandTotal = Array.from(totals.values()).reduce((acc, value) => acc + value, 0);

  return (['partnerA', 'partnerB', 'shared'] as const)
    .filter((owner) => totals.has(owner))
    .map((owner) => {
      const amount = totals.get(owner) ?? 0;
      return { owner, amount: round2(amount), share: grandTotal > 0 ? amount / grandTotal : 0 };
    });
}

/**
 * Contribution réelle de chaque partenaire.
 *
 * On se fonde sur `paid_by` pour les dépenses — c'est qui a effectivement
 * décaissé, pas à qui la ligne est attribuée. Pour les factures, `owner`
 * fait foi : une facture commune est réputée réglée par le foyer, donc
 * répartie à parts égales.
 */
export function computeContributions(dataset: FinanceDataset): ContributionBreakdown[] {
  const paid: Record<PartnerSlot, number> = { partnerA: 0, partnerB: 0 };
  const income: Record<PartnerSlot, number> = { partnerA: 0, partnerB: 0 };

  for (const expense of dataset.expenses) {
    paid[expense.paid_by] += Number(expense.amount);
  }

  for (const bill of dataset.bills) {
    const amount = Number(bill.amount);
    if (bill.owner === 'shared') {
      paid.partnerA += amount / 2;
      paid.partnerB += amount / 2;
    } else {
      paid[bill.owner] += amount;
    }
  }

  for (const entry of dataset.incomes) {
    const amount = Number(entry.amount);
    if (entry.owner === 'shared') {
      income.partnerA += amount / 2;
      income.partnerB += amount / 2;
    } else {
      income[entry.owner] += amount;
    }
  }

  const totalPaid = paid.partnerA + paid.partnerB;
  const totalIncome = income.partnerA + income.partnerB;

  return (['partnerA', 'partnerB'] as const).map((slot) => ({
    slot,
    paidAmount: round2(paid[slot]),
    paidShare: totalPaid > 0 ? paid[slot] / totalPaid : 0,
    income: round2(income[slot]),
    incomeShare: totalIncome > 0 ? income[slot] / totalIncome : 0,
  }));
}

/** Les `limit` plus grosses dépenses de la période. */
export function topExpenses(dataset: FinanceDataset, limit = 5) {
  return [...dataset.expenses]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, limit);
}

/**
 * Dépenses inhabituelles : au-dessus de `factor` fois la dépense médiane de
 * la période. La médiane plutôt que la moyenne, sinon une seule grosse
 * dépense relèverait le seuil et se masquerait elle-même.
 */
export function unusualExpenses(dataset: FinanceDataset, factor = 3) {
  if (dataset.expenses.length < 4) return [];

  const amounts = dataset.expenses.map((expense) => Number(expense.amount)).sort((a, b) => a - b);
  const middle = Math.floor(amounts.length / 2);
  const median =
    amounts.length % 2 === 0
      ? ((amounts[middle - 1] ?? 0) + (amounts[middle] ?? 0)) / 2
      : (amounts[middle] ?? 0);

  if (median <= 0) return [];

  return dataset.expenses
    .filter((expense) => Number(expense.amount) > median * factor)
    .sort((a, b) => Number(b.amount) - Number(a.amount));
}

/** Catégorie la plus coûteuse de la période, ou `null` si aucune dépense. */
export function mostExpensiveCategory(dataset: FinanceDataset): CategoryBreakdown | null {
  return computeCategoryBreakdown(dataset)[0] ?? null;
}

/**
 * Économies potentielles : le dépassement cumulé des plafonds de catégorie.
 * C'est le montant qu'il aurait fallu ne pas dépenser pour tenir le budget.
 */
export function potentialSavings(dataset: FinanceDataset): number {
  const spentByCategory = new Map<string, number>();
  for (const expense of dataset.expenses) {
    spentByCategory.set(
      expense.category,
      (spentByCategory.get(expense.category) ?? 0) + Number(expense.amount),
    );
  }

  let overshoot = 0;
  for (const budget of dataset.budgets) {
    const spent = spentByCategory.get(budget.category) ?? 0;
    const limit = Number(budget.monthly_limit);
    if (spent > limit) overshoot += spent - limit;
  }

  return round2(overshoot);
}

/**
 * Série mensuelle pour les graphiques d'évolution.
 * `dataset` doit couvrir toute la plage : le filtrage par mois est fait ici.
 */
export function computeMonthlyTrend(
  dataset: FinanceDataset,
  periods: Array<{ year: number; month: number }>,
  today = new Date(),
): MonthlyTrendPoint[] {
  let cumulativeSavings = 0;
  let cumulativeInvested = 0;
  let cumulativeValue = 0;

  return periods.map(({ year, month }) => {
    const slice = periodDataset(dataset, year, month);
    const totals = computeMonthlyTotals(slice, year, month, today);

    cumulativeSavings = round2(cumulativeSavings + totals.totalSavings);
    cumulativeInvested = round2(cumulativeInvested + totals.totalInvested);
    cumulativeValue = round2(
      cumulativeValue + sum(slice.investments.map((i) => Number(i.current_value))),
    );

    return {
      year,
      month,
      key: monthKey(year, month),
      label: formatMonthShort(year, month),
      income: totals.totalIncome,
      expenses: totals.totalExpenses,
      bills: totals.totalBills,
      savings: totals.totalSavings,
      cumulativeSavings,
      invested: totals.totalInvested,
      cumulativeInvested,
      cumulativeValue,
      balance: totals.monthlyBalance,
    };
  });
}

/** Valeur et plus-value du portefeuille, tous millésimes confondus. */
export function computePortfolio(dataset: FinanceDataset) {
  const invested = sum(dataset.investments.map((i) => Number(i.invested_amount)));
  const value = sum(dataset.investments.map((i) => Number(i.current_value)));
  const gain = round2(value - invested);

  return {
    invested,
    value,
    gain,
    gainRatio: invested > 0 ? round2(gain / invested * 100) / 100 : 0,
  };
}

/** Totaux d'épargne tous objectifs confondus. */
export function computeSavingsOverview(dataset: FinanceDataset) {
  const target = sum(dataset.goals.map((goal) => Number(goal.target_amount)));
  const current = sum(dataset.goals.map((goal) => Number(goal.current_amount)));

  return {
    target,
    current,
    remaining: round2(Math.max(0, target - current)),
    progress: target > 0 ? round2(current / target * 100) / 100 : 0,
  };
}
