import { describe, expect, it } from 'vitest';
import {
  capCategories,
  computeCategoryBreakdown,
  computeContributions,
  computeDelta,
  computeMonthlyTotals,
  computeMonthlyTrend,
  computeOwnerBreakdown,
  computePortfolio,
  computeSavingsOverview,
  elapsedDaysInMonth,
  filterByScope,
  mostExpensiveCategory,
  periodDataset,
  potentialSavings,
  round2,
  topExpenses,
  unusualExpenses,
} from './calculations';
import { emptyDataset, type FinanceDataset } from './types';
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

// --- Constructeurs de test -------------------------------------------------
// Volontairement minimalistes : seuls les champs qui influent sur les calculs
// sont paramétrables, le reste est du remplissage constant.

const BASE = {
  household_id: 'h1',
  created_by: 'u1',
  note: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

function income(
  amount: number,
  owner: OwnerSlot = 'partnerA',
  period = { year: 2026, month: 3 },
): IncomeRow {
  return {
    ...BASE,
    id: `inc-${Math.random()}`,
    owner,
    owner_type: owner === 'shared' ? 'shared' : 'private',
    date: `${period.year}-${String(period.month).padStart(2, '0')}-05`,
    year: period.year,
    month: period.month,
    amount,
    income_type: 'salary',
    label: 'Salaire',
  };
}

function expense(
  amount: number,
  options: {
    owner?: OwnerSlot;
    category?: string;
    kind?: 'fixed' | 'variable';
    paidBy?: PartnerSlot;
    period?: { year: number; month: number };
  } = {},
): ExpenseRow {
  const {
    owner = 'shared',
    category = 'Alimentation',
    kind = 'variable',
    paidBy = 'partnerA',
    period = { year: 2026, month: 3 },
  } = options;

  return {
    ...BASE,
    id: `exp-${Math.random()}`,
    owner,
    owner_type: owner === 'shared' ? 'shared' : 'private',
    date: `${period.year}-${String(period.month).padStart(2, '0')}-10`,
    year: period.year,
    month: period.month,
    amount,
    category,
    subcategory: null,
    kind,
    paid_by: paidBy,
    label: category,
  };
}

function bill(
  amount: number,
  options: {
    owner?: OwnerSlot;
    status?: 'paid' | 'pending' | 'overdue';
    period?: { year: number; month: number };
  } = {},
): BillRow {
  const { owner = 'shared', status = 'pending', period = { year: 2026, month: 3 } } = options;

  return {
    ...BASE,
    id: `bill-${Math.random()}`,
    owner,
    owner_type: owner === 'shared' ? 'shared' : 'private',
    date: `${period.year}-${String(period.month).padStart(2, '0')}-04`,
    year: period.year,
    month: period.month,
    amount,
    label: 'Loyer',
    category: 'Logement',
    frequency: 'monthly',
    status,
  };
}

function contribution(
  amount: number,
  options: { owner?: OwnerSlot; goalId?: string; period?: { year: number; month: number } } = {},
): SavingsContributionRow {
  const { owner = 'shared', goalId = 'g1', period = { year: 2026, month: 3 } } = options;

  return {
    ...BASE,
    id: `sc-${Math.random()}`,
    goal_id: goalId,
    owner,
    owner_type: owner === 'shared' ? 'shared' : 'private',
    date: `${period.year}-${String(period.month).padStart(2, '0')}-03`,
    year: period.year,
    month: period.month,
    amount,
  };
}

function investment(
  invested: number,
  value: number,
  options: { owner?: OwnerSlot; period?: { year: number; month: number } } = {},
): InvestmentRow {
  const { owner = 'shared', period = { year: 2026, month: 3 } } = options;

  return {
    ...BASE,
    id: `inv-${Math.random()}`,
    owner,
    owner_type: owner === 'shared' ? 'shared' : 'private',
    date: `${period.year}-${String(period.month).padStart(2, '0')}-07`,
    year: period.year,
    month: period.month,
    label: 'ETF',
    investment_type: 'stocks',
    invested_amount: invested,
    current_value: value,
  };
}

function goal(
  target: number,
  current: number,
  options: { owner?: OwnerSlot; id?: string } = {},
): SavingsGoalWithProgressRow {
  const { owner = 'shared', id = 'g1' } = options;

  return {
    ...BASE,
    id,
    owner,
    owner_type: owner === 'shared' ? 'shared' : 'private',
    name: 'Objectif',
    target_amount: target,
    target_date: null,
    current_amount: current,
    progress_percent: target > 0 ? (current / target) * 100 : 0,
  };
}

function budget(category: string, limit: number): CategoryBudgetRow {
  return {
    ...BASE,
    id: `bud-${category}`,
    owner: 'shared',
    owner_type: 'shared',
    category,
    monthly_limit: limit,
  };
}

// ---------------------------------------------------------------------------

describe('round2', () => {
  it('élimine la dérive du flottant', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1234.567)).toBe(1234.57);
  });
});

describe('computeMonthlyTotals', () => {
  const dataset: FinanceDataset = {
    ...emptyDataset(),
    incomes: [income(2500, 'partnerA'), income(2000, 'partnerB')],
    expenses: [
      expense(400, { kind: 'variable', category: 'Alimentation' }),
      expense(100, { kind: 'fixed', category: 'Abonnements' }),
    ],
    bills: [bill(950), bill(50, { status: 'paid' })],
    contributions: [contribution(500)],
    investments: [investment(300, 320)],
  };

  const totals = computeMonthlyTotals(dataset, 2026, 3, new Date('2026-03-31T12:00:00'));

  it('additionne les revenus des deux partenaires', () => {
    expect(totals.totalIncome).toBe(4500);
  });

  it('sépare charges fixes et variables', () => {
    expect(totals.fixedExpenses).toBe(100);
    expect(totals.variableExpenses).toBe(400);
    expect(totals.totalExpenses).toBe(500);
  });

  it('ne confond jamais dépenses et factures', () => {
    // 1 000 € de factures s'ajoutent aux 500 € de dépenses, sans double compte.
    expect(totals.totalBills).toBe(1000);
    expect(totals.totalOutflow).toBe(1500);
  });

  it('isole les factures non réglées', () => {
    expect(totals.unpaidBills).toBe(950);
  });

  it('déduit épargne et investissements du reste à vivre', () => {
    // 4500 − 1500 − 500 − 300
    expect(totals.remainingToLive).toBe(2200);
    expect(totals.monthlyBalance).toBe(2200);
  });

  it('exprime le taux d’épargne en proportion', () => {
    // 500 / 4500
    expect(totals.savingsRate).toBeCloseTo(0.1111, 4);
  });

  it('rapporte les charges fixes aux revenus', () => {
    // (100 + 1000) / 4500
    expect(totals.fixedChargeRatio).toBeCloseTo(0.2444, 4);
  });

  it('calcule la moyenne journalière sur les jours écoulés', () => {
    // 500 € sur 31 jours de mars
    expect(totals.dailyAverageExpense).toBeCloseTo(16.13, 2);
  });

  it('rend des totaux nuls sur un jeu de données vide', () => {
    const empty = computeMonthlyTotals(emptyDataset(), 2026, 3, new Date('2026-03-31'));
    expect(empty.totalIncome).toBe(0);
    expect(empty.savingsRate).toBe(0);
    expect(empty.dailyAverageExpense).toBe(0);
  });
});

describe('elapsedDaysInMonth', () => {
  it('s’arrête à aujourd’hui pour le mois en cours', () => {
    expect(elapsedDaysInMonth(2026, 3, new Date('2026-03-12T09:00:00'))).toBe(12);
  });

  it('prend le mois entier pour un mois passé', () => {
    expect(elapsedDaysInMonth(2026, 2, new Date('2026-03-12T09:00:00'))).toBe(28);
  });

  it('rend zéro pour un mois futur', () => {
    expect(elapsedDaysInMonth(2026, 5, new Date('2026-03-12T09:00:00'))).toBe(0);
  });
});

describe('computeDelta', () => {
  it('calcule une hausse', () => {
    expect(computeDelta(120, 100)).toEqual({ ratio: 0.2, absolute: 20 });
  });

  it('calcule une baisse', () => {
    expect(computeDelta(80, 100)).toEqual({ ratio: -0.2, absolute: -20 });
  });

  it('rend un ratio nul quand la référence est zéro', () => {
    // Aucune variation en pourcentage n'a de sens depuis zéro.
    expect(computeDelta(50, 0)).toEqual({ ratio: null, absolute: 50 });
  });

  it('reste correct quand la référence est négative', () => {
    expect(computeDelta(-50, -100).ratio).toBe(0.5);
  });
});

describe('filterByScope', () => {
  const records = [
    expense(10, { owner: 'partnerA' }),
    expense(20, { owner: 'partnerB' }),
    expense(30, { owner: 'shared' }),
  ];

  it('« mes données » ne garde que ma place', () => {
    expect(filterByScope(records, 'mine', 'partnerA')).toHaveLength(1);
    expect(filterByScope(records, 'mine', 'partnerA')[0]?.amount).toBe(10);
  });

  it('« données partagées » ne garde que le commun', () => {
    expect(filterByScope(records, 'shared', 'partnerA')).toHaveLength(1);
    expect(filterByScope(records, 'shared', 'partnerA')[0]?.amount).toBe(30);
  });

  it('« vue couple » garde tout ce que la RLS a livré', () => {
    expect(filterByScope(records, 'couple', 'partnerA')).toHaveLength(3);
  });

  it('ne rend rien pour « mes données » sans place attribuée', () => {
    expect(filterByScope(records, 'mine', null)).toHaveLength(0);
  });
});

describe('periodDataset', () => {
  it('filtre les flux sur le mois mais conserve objectifs et budgets', () => {
    const dataset: FinanceDataset = {
      ...emptyDataset(),
      expenses: [
        expense(10, { period: { year: 2026, month: 3 } }),
        expense(20, { period: { year: 2026, month: 4 } }),
      ],
      goals: [goal(1000, 200)],
      budgets: [budget('Alimentation', 500)],
    };

    const march = periodDataset(dataset, 2026, 3);
    expect(march.expenses).toHaveLength(1);
    // Un objectif ou un plafond n'appartient pas à un mois donné.
    expect(march.goals).toHaveLength(1);
    expect(march.budgets).toHaveLength(1);
  });
});

describe('computeCategoryBreakdown', () => {
  const dataset: FinanceDataset = {
    ...emptyDataset(),
    expenses: [
      expense(300, { category: 'Alimentation' }),
      expense(100, { category: 'Alimentation' }),
      expense(200, { category: 'Transport' }),
    ],
  };

  const breakdown = computeCategoryBreakdown(dataset);

  it('trie de la catégorie la plus lourde à la plus légère', () => {
    expect(breakdown.map((item) => item.category)).toEqual(['Alimentation', 'Transport']);
  });

  it('cumule les montants et compte les transactions', () => {
    expect(breakdown[0]?.amount).toBe(400);
    expect(breakdown[0]?.transactionCount).toBe(2);
  });

  it('exprime des parts qui totalisent 1', () => {
    const total = breakdown.reduce((acc, item) => acc + item.share, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('désigne la catégorie la plus coûteuse', () => {
    expect(mostExpensiveCategory(dataset)?.category).toBe('Alimentation');
    expect(mostExpensiveCategory(emptyDataset())).toBeNull();
  });
});

describe('capCategories', () => {
  const breakdown = computeCategoryBreakdown({
    ...emptyDataset(),
    expenses: [
      expense(100, { category: 'A' }),
      expense(90, { category: 'B' }),
      expense(80, { category: 'C' }),
      expense(70, { category: 'D' }),
      expense(60, { category: 'E' }),
    ],
  });

  it('regroupe le surplus dans « Autres » sans perdre de montant', () => {
    const capped = capCategories(breakdown, 3);
    expect(capped).toHaveLength(3);
    expect(capped[2]?.category).toBe('Autres');
    expect(capped[2]?.amount).toBe(210); // 80 + 70 + 60
    expect(capped.reduce((acc, item) => acc + item.amount, 0)).toBe(400);
  });

  it('ne touche à rien si le nombre de tranches tient déjà', () => {
    expect(capCategories(breakdown, 8)).toHaveLength(5);
  });
});

describe('computeOwnerBreakdown', () => {
  it('répartit un flux entre les places du foyer', () => {
    const result = computeOwnerBreakdown([
      { owner: 'partnerA', amount: 300 },
      { owner: 'partnerB', amount: 100 },
      { owner: 'shared', amount: 100 },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ owner: 'partnerA', amount: 300, share: 0.6 });
  });

  it('omet les places sans montant plutôt que d’afficher un zéro', () => {
    const result = computeOwnerBreakdown([{ owner: 'shared', amount: 50 }]);
    expect(result).toHaveLength(1);
    expect(result[0]?.owner).toBe('shared');
  });
});

describe('computeContributions', () => {
  const dataset: FinanceDataset = {
    ...emptyDataset(),
    incomes: [income(3000, 'partnerA'), income(1000, 'partnerB')],
    expenses: [
      expense(200, { owner: 'shared', paidBy: 'partnerA' }),
      expense(100, { owner: 'shared', paidBy: 'partnerB' }),
    ],
    bills: [bill(400, { owner: 'shared' }), bill(100, { owner: 'partnerB' })],
  };

  const contributions = computeContributions(dataset);
  const partnerA = contributions.find((entry) => entry.slot === 'partnerA');
  const partnerB = contributions.find((entry) => entry.slot === 'partnerB');

  it('attribue une dépense à son payeur réel, pas à son propriétaire', () => {
    // A : 200 de dépenses + 200 (moitié de la facture commune) = 400
    expect(partnerA?.paidAmount).toBe(400);
    // B : 100 de dépenses + 200 (moitié commune) + 100 (facture perso) = 400
    expect(partnerB?.paidAmount).toBe(400);
  });

  it('partage une facture commune à parts égales', () => {
    expect(partnerA?.paidShare).toBeCloseTo(0.5, 10);
    expect(partnerB?.paidShare).toBeCloseTo(0.5, 10);
  });

  it('mesure aussi le poids des revenus de chacun', () => {
    expect(partnerA?.incomeShare).toBeCloseTo(0.75, 10);
    expect(partnerB?.incomeShare).toBeCloseTo(0.25, 10);
  });
});

describe('topExpenses & unusualExpenses', () => {
  const dataset: FinanceDataset = {
    ...emptyDataset(),
    expenses: [
      expense(50, { category: 'A' }),
      expense(60, { category: 'B' }),
      expense(55, { category: 'C' }),
      expense(45, { category: 'D' }),
      expense(900, { category: 'Exception' }),
    ],
  };

  it('classe les plus grosses dépenses', () => {
    const top = topExpenses(dataset, 2);
    expect(top).toHaveLength(2);
    expect(top[0]?.amount).toBe(900);
  });

  it('détecte une dépense hors norme via la médiane', () => {
    const unusual = unusualExpenses(dataset);
    expect(unusual).toHaveLength(1);
    expect(unusual[0]?.category).toBe('Exception');
  });

  it('ne signale rien sur un échantillon trop petit', () => {
    const small: FinanceDataset = { ...emptyDataset(), expenses: [expense(10), expense(900)] };
    expect(unusualExpenses(small)).toHaveLength(0);
  });
});

describe('potentialSavings', () => {
  it('additionne les dépassements de plafond', () => {
    const dataset: FinanceDataset = {
      ...emptyDataset(),
      expenses: [expense(700, { category: 'Alimentation' }), expense(150, { category: 'Loisirs' })],
      budgets: [budget('Alimentation', 500), budget('Loisirs', 200)],
    };

    // Alimentation dépasse de 200, Loisirs est sous son plafond.
    expect(potentialSavings(dataset)).toBe(200);
  });

  it('rend zéro quand tous les budgets sont tenus', () => {
    const dataset: FinanceDataset = {
      ...emptyDataset(),
      expenses: [expense(100, { category: 'Alimentation' })],
      budgets: [budget('Alimentation', 500)],
    };
    expect(potentialSavings(dataset)).toBe(0);
  });
});

describe('computeMonthlyTrend', () => {
  const dataset: FinanceDataset = {
    ...emptyDataset(),
    incomes: [
      income(2000, 'partnerA', { year: 2026, month: 1 }),
      income(2100, 'partnerA', { year: 2026, month: 2 }),
    ],
    contributions: [
      contribution(300, { period: { year: 2026, month: 1 } }),
      contribution(200, { period: { year: 2026, month: 2 } }),
    ],
    investments: [
      investment(100, 110, { period: { year: 2026, month: 1 } }),
      investment(100, 105, { period: { year: 2026, month: 2 } }),
    ],
  };

  const trend = computeMonthlyTrend(
    dataset,
    [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ],
    new Date('2026-03-01'),
  );

  it('produit un point par période demandée', () => {
    expect(trend).toHaveLength(2);
    expect(trend[0]?.key).toBe('2026-01');
  });

  it('cumule l’épargne au fil des mois', () => {
    expect(trend[0]?.cumulativeSavings).toBe(300);
    expect(trend[1]?.cumulativeSavings).toBe(500);
  });

  it('cumule séparément le montant investi et la valeur du portefeuille', () => {
    expect(trend[1]?.cumulativeInvested).toBe(200);
    expect(trend[1]?.cumulativeValue).toBe(215);
  });

  it('rend une série de zéros pour des mois sans données', () => {
    const empty = computeMonthlyTrend(emptyDataset(), [{ year: 2026, month: 1 }]);
    expect(empty[0]?.income).toBe(0);
    expect(empty[0]?.cumulativeSavings).toBe(0);
  });
});

describe('computePortfolio', () => {
  it('calcule la plus-value et son rendement', () => {
    const dataset: FinanceDataset = {
      ...emptyDataset(),
      investments: [investment(1000, 1150), investment(500, 480)],
    };

    const portfolio = computePortfolio(dataset);
    expect(portfolio.invested).toBe(1500);
    expect(portfolio.value).toBe(1630);
    expect(portfolio.gain).toBe(130);
    expect(portfolio.gainRatio).toBeCloseTo(0.0867, 4);
  });

  it('ne divise pas par zéro sans investissement', () => {
    expect(computePortfolio(emptyDataset()).gainRatio).toBe(0);
  });
});

describe('computeSavingsOverview', () => {
  it('agrège la progression de tous les objectifs', () => {
    const dataset: FinanceDataset = {
      ...emptyDataset(),
      goals: [goal(10000, 2500, { id: 'g1' }), goal(5000, 5000, { id: 'g2' })],
    };

    const overview = computeSavingsOverview(dataset);
    expect(overview.target).toBe(15000);
    expect(overview.current).toBe(7500);
    expect(overview.remaining).toBe(7500);
    expect(overview.progress).toBe(0.5);
  });

  it('ne rend jamais un reste négatif sur un objectif dépassé', () => {
    const dataset: FinanceDataset = { ...emptyDataset(), goals: [goal(1000, 1500)] };
    expect(computeSavingsOverview(dataset).remaining).toBe(0);
  });
});
