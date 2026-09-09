import { describe, expect, it } from 'vitest';
import { evaluateAlerts, summarizeAlerts, type FinanceAlert } from './alerts';
import { computeMonthlyTotals } from './calculations';
import { formatCurrency } from '@/lib/format';
import { emptyDataset, type FinanceDataset } from './types';
import type { BillRow, CategoryBudgetRow, ExpenseRow } from '@/types/database';

const BASE = {
  household_id: 'h1',
  created_by: 'u1',
  note: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  deleted_at: null,
  owner: 'shared' as const,
  owner_type: 'shared' as const,
};

function expense(amount: number, category: string): ExpenseRow {
  return {
    ...BASE,
    id: `exp-${category}-${amount}`,
    date: '2026-03-10',
    year: 2026,
    month: 3,
    amount,
    category,
    subcategory: null,
    kind: 'variable',
    paid_by: 'partnerA',
    label: category,
  };
}

function budget(category: string, limit: number): CategoryBudgetRow {
  return { ...BASE, id: `bud-${category}`, category, monthly_limit: limit };
}

/** `dayOffset` est relatif à aujourd'hui : les règles d'échéance sont datées. */
function bill(amount: number, dayOffset: number, status: 'pending' | 'paid' | 'overdue'): BillRow {
  const due = new Date();
  due.setDate(due.getDate() + dayOffset);
  const iso = due.toISOString().slice(0, 10);

  return {
    ...BASE,
    id: `bill-${dayOffset}`,
    date: iso,
    year: due.getFullYear(),
    month: due.getMonth() + 1,
    amount,
    label: 'Électricité',
    category: 'Énergie',
    frequency: 'monthly',
    status,
  };
}

function evaluate(dataset: FinanceDataset, previousSavings = 0): FinanceAlert[] {
  const totals = computeMonthlyTotals(dataset, 2026, 3, new Date('2026-03-15'));
  return evaluateAlerts({ dataset, totals, previousSavings, year: 2026, month: 3 });
}

describe('evaluateAlerts — budgets de catégorie', () => {
  it('signale un dépassement en critique', () => {
    const alerts = evaluate({
      ...emptyDataset(),
      expenses: [expense(700, 'Alimentation')],
      budgets: [budget('Alimentation', 500)],
    });

    const alert = alerts.find((item) => item.type === 'category_overrun');
    expect(alert?.severity).toBe('critical');
    // Comparé via `formatCurrency` plutôt qu'à une chaîne figée : ce qui est
    // testé, c'est que le dépassement de 200 apparaisse dans le message —
    // pas le format d'une devise particulière.
    expect(alert?.body).toContain(formatCurrency(200));
  });

  it('prévient dès 85 % du plafond', () => {
    const alerts = evaluate({
      ...emptyDataset(),
      expenses: [expense(430, 'Alimentation')],
      budgets: [budget('Alimentation', 500)],
    });

    expect(alerts.some((item) => item.type === 'category_near_limit')).toBe(true);
  });

  it('reste silencieux sous le seuil', () => {
    const alerts = evaluate({
      ...emptyDataset(),
      expenses: [expense(200, 'Alimentation')],
      budgets: [budget('Alimentation', 500)],
    });

    expect(alerts.filter((item) => item.type.startsWith('category_'))).toHaveLength(0);
  });
});

describe('evaluateAlerts — factures', () => {
  it('signale une facture en retard', () => {
    const alerts = evaluate({ ...emptyDataset(), bills: [bill(95, -3, 'overdue')] });
    const alert = alerts.find((item) => item.type === 'bill_overdue');
    expect(alert?.severity).toBe('critical');
    expect(alert?.body).toContain('3 jour(s)');
  });

  it('rappelle une échéance proche', () => {
    const alerts = evaluate({ ...emptyDataset(), bills: [bill(95, 3, 'pending')] });
    expect(alerts.some((item) => item.type === 'bill_due_soon')).toBe(true);
  });

  it('ignore une facture déjà payée', () => {
    const alerts = evaluate({ ...emptyDataset(), bills: [bill(95, -3, 'paid')] });
    expect(alerts.filter((item) => item.type.startsWith('bill_'))).toHaveLength(0);
  });

  it('ne rappelle pas une échéance lointaine', () => {
    const alerts = evaluate({ ...emptyDataset(), bills: [bill(95, 25, 'pending')] });
    expect(alerts.filter((item) => item.type.startsWith('bill_'))).toHaveLength(0);
  });
});

describe('evaluateAlerts — épargne et solde', () => {
  it('signale un décrochage de l’épargne', () => {
    const dataset: FinanceDataset = { ...emptyDataset() };
    const alerts = evaluate(dataset, 500);
    expect(alerts.some((item) => item.type === 'savings_drop')).toBe(true);
  });

  it('ne signale rien sans référence du mois précédent', () => {
    const alerts = evaluate(emptyDataset(), 0);
    expect(alerts.some((item) => item.type === 'savings_drop')).toBe(false);
  });

  it('passe le solde négatif en critique', () => {
    const dataset: FinanceDataset = {
      ...emptyDataset(),
      incomes: [
        {
          ...BASE,
          id: 'inc',
          date: '2026-03-01',
          year: 2026,
          month: 3,
          amount: 1000,
          income_type: 'salary',
          label: 'Salaire',
        },
      ],
      expenses: [expense(1500, 'Divers')],
    };

    const alert = evaluate(dataset).find((item) => item.type === 'low_balance');
    expect(alert?.severity).toBe('critical');
    expect(alert?.title).toContain('négatif');
  });

  it('n’évalue pas le solde sans revenu déclaré', () => {
    // Un mois sans revenu saisi n'est pas un mois déficitaire : c'est un mois
    // incomplet. Alerter ici ne ferait que du bruit.
    const alerts = evaluate({ ...emptyDataset(), expenses: [expense(500, 'Divers')] });
    expect(alerts.some((item) => item.type === 'low_balance')).toBe(false);
  });
});

describe('evaluateAlerts — clés de déduplication', () => {
  it('produit une clé stable entre deux évaluations', () => {
    const dataset: FinanceDataset = {
      ...emptyDataset(),
      expenses: [expense(700, 'Alimentation')],
      budgets: [budget('Alimentation', 500)],
    };

    const first = evaluate(dataset).map((alert) => alert.dedupeKey);
    const second = evaluate(dataset).map((alert) => alert.dedupeKey);
    expect(first).toEqual(second);
  });

  it('n’émet jamais deux fois la même clé dans un même lot', () => {
    const alerts = evaluate({
      ...emptyDataset(),
      expenses: [expense(700, 'Alimentation'), expense(400, 'Loisirs')],
      budgets: [budget('Alimentation', 500), budget('Loisirs', 300)],
      bills: [bill(95, -2, 'overdue')],
    });

    const keys = alerts.map((alert) => alert.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('evaluateAlerts — tri et synthèse', () => {
  it('place les alertes critiques en tête', () => {
    const alerts = evaluate({
      ...emptyDataset(),
      expenses: [expense(700, 'Alimentation')],
      budgets: [budget('Alimentation', 500)],
      bills: [bill(95, 2, 'pending')],
    });

    expect(alerts[0]?.severity).toBe('critical');
  });

  it('compte les alertes par gravité', () => {
    const alerts = evaluate({
      ...emptyDataset(),
      expenses: [expense(700, 'Alimentation')],
      budgets: [budget('Alimentation', 500)],
      bills: [bill(95, 2, 'pending')],
    });

    const summary = summarizeAlerts(alerts);
    expect(summary.total).toBe(alerts.length);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBeGreaterThanOrEqual(1);
  });
});
