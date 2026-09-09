/**
 * Règles d'alerte — fonctions pures évaluées à chaque chargement.
 *
 * Chaque alerte porte une `dedupeKey` stable : elle identifie le fait signalé,
 * pas l'instant de l'évaluation. C'est ce qui permet de persister les alertes
 * en `upsert … on conflict do nothing` sans créer de doublon à chaque visite,
 * et de conserver l'état « lu / rejeté ».
 */

import { ALERT_THRESHOLDS } from '@/lib/constants';
import { daysUntil, formatCurrency, monthKey } from '@/lib/format';
import type { AlertLevel } from '@/types/database';
import type { FinanceDataset, MonthlyTotals } from './types';
import { round2 } from './calculations';

export type AlertType =
  | 'category_overrun'
  | 'category_near_limit'
  | 'bill_overdue'
  | 'bill_due_soon'
  | 'savings_drop'
  | 'goal_off_track'
  | 'low_balance';

export interface FinanceAlert {
  type: AlertType;
  severity: AlertLevel;
  title: string;
  body: string;
  dedupeKey: string;
  /** Route vers laquelle envoyer l'utilisateur pour agir. */
  href: string;
}

interface AlertContext {
  dataset: FinanceDataset;
  totals: MonthlyTotals;
  /** Épargne nette du mois précédent, pour détecter un décrochage. */
  previousSavings: number;
  year: number;
  month: number;
}

/**
 * Évalue toutes les règles et rend les alertes triées par gravité décroissante.
 * Le jeu de données doit déjà être filtré sur la période et le périmètre.
 */
export function evaluateAlerts(context: AlertContext): FinanceAlert[] {
  const { dataset, totals, previousSavings, year, month } = context;
  const period = monthKey(year, month);
  const alerts: FinanceAlert[] = [];

  // --- Budgets de catégorie ------------------------------------------------
  const spentByCategory = new Map<string, number>();
  for (const expense of dataset.expenses) {
    spentByCategory.set(
      expense.category,
      (spentByCategory.get(expense.category) ?? 0) + Number(expense.amount),
    );
  }

  for (const budget of dataset.budgets) {
    const limit = Number(budget.monthly_limit);
    if (limit <= 0) continue;

    const spent = round2(spentByCategory.get(budget.category) ?? 0);
    const ratio = spent / limit;

    if (ratio > 1) {
      alerts.push({
        type: 'category_overrun',
        severity: 'critical',
        title: `Budget dépassé : ${budget.category}`,
        body: `${formatCurrency(spent)} dépensés sur un plafond de ${formatCurrency(limit)}, soit ${formatCurrency(round2(spent - limit))} de trop.`,
        dedupeKey: `category_overrun:${period}:${budget.id}`,
        href: '/depenses',
      });
    } else if (ratio >= ALERT_THRESHOLDS.categoryWarningRatio) {
      alerts.push({
        type: 'category_near_limit',
        severity: 'warning',
        title: `Budget bientôt atteint : ${budget.category}`,
        body: `${formatCurrency(spent)} sur ${formatCurrency(limit)} — il reste ${formatCurrency(round2(limit - spent))}.`,
        dedupeKey: `category_near_limit:${period}:${budget.id}`,
        href: '/depenses',
      });
    }
  }

  // --- Factures ------------------------------------------------------------
  for (const bill of dataset.bills) {
    if (bill.status === 'paid') continue;

    const remainingDays = daysUntil(bill.date);

    if (bill.status === 'overdue' || remainingDays < 0) {
      alerts.push({
        type: 'bill_overdue',
        severity: 'critical',
        title: `Facture en retard : ${bill.label}`,
        body: `${formatCurrency(Number(bill.amount))} — échéance dépassée de ${Math.abs(remainingDays)} jour(s).`,
        dedupeKey: `bill_overdue:${bill.id}`,
        href: '/factures',
      });
    } else if (remainingDays <= ALERT_THRESHOLDS.billDueSoonDays) {
      alerts.push({
        type: 'bill_due_soon',
        severity: 'warning',
        title: `Échéance proche : ${bill.label}`,
        body:
          remainingDays === 0
            ? `${formatCurrency(Number(bill.amount))} à régler aujourd’hui.`
            : `${formatCurrency(Number(bill.amount))} à régler dans ${remainingDays} jour(s).`,
        dedupeKey: `bill_due_soon:${bill.id}`,
        href: '/factures',
      });
    }
  }

  // --- Épargne -------------------------------------------------------------
  if (previousSavings > 0) {
    const drop = (previousSavings - totals.totalSavings) / previousSavings;
    if (drop >= ALERT_THRESHOLDS.savingsDropRatio) {
      alerts.push({
        type: 'savings_drop',
        severity: 'warning',
        title: 'Épargne en baisse',
        body: `${formatCurrency(totals.totalSavings)} ce mois-ci contre ${formatCurrency(previousSavings)} le mois précédent.`,
        dedupeKey: `savings_drop:${period}`,
        href: '/epargne',
      });
    }
  }

  // --- Objectifs hors trajectoire -----------------------------------------
  for (const goal of dataset.goals) {
    if (!goal.target_date) continue;

    const remainingDays = daysUntil(goal.target_date);
    const remainingAmount = round2(Number(goal.target_amount) - Number(goal.current_amount));
    if (remainingAmount <= 0) continue;

    if (remainingDays < 0) {
      alerts.push({
        type: 'goal_off_track',
        severity: 'warning',
        title: `Objectif non atteint : ${goal.name}`,
        body: `Date cible dépassée, il manque ${formatCurrency(remainingAmount)}.`,
        dedupeKey: `goal_off_track:${goal.id}`,
        href: '/epargne',
      });
      continue;
    }

    // Rythme nécessaire pour tenir la date cible, comparé à l'effort du mois.
    const remainingMonths = Math.max(1, Math.ceil(remainingDays / 30));
    const requiredPerMonth = remainingAmount / remainingMonths;
    const currentPace = dataset.contributions
      .filter((contribution) => contribution.goal_id === goal.id)
      .reduce((total, contribution) => total + Number(contribution.amount), 0);

    if (currentPace < requiredPerMonth * 0.6) {
      alerts.push({
        type: 'goal_off_track',
        severity: 'info',
        title: `Rythme insuffisant : ${goal.name}`,
        body: `Il faudrait ${formatCurrency(round2(requiredPerMonth))} par mois pour tenir la date cible (${formatCurrency(round2(currentPace))} ce mois-ci).`,
        dedupeKey: `goal_pace:${period}:${goal.id}`,
        href: '/epargne',
      });
    }
  }

  // --- Solde de fin de mois ------------------------------------------------
  if (totals.totalIncome > 0 && totals.monthlyBalance < ALERT_THRESHOLDS.lowBalance) {
    const isNegative = totals.monthlyBalance < 0;
    alerts.push({
      type: 'low_balance',
      severity: isNegative ? 'critical' : 'warning',
      title: isNegative ? 'Solde mensuel négatif' : 'Solde de fin de mois faible',
      body: `Il reste ${formatCurrency(totals.monthlyBalance)} après charges, épargne et investissements.`,
      dedupeKey: `low_balance:${period}`,
      href: '/synthese',
    });
  }

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Compteurs pour la pastille du centre de notifications. */
export function summarizeAlerts(alerts: FinanceAlert[]) {
  return {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === 'critical').length,
    warning: alerts.filter((alert) => alert.severity === 'warning').length,
    info: alerts.filter((alert) => alert.severity === 'info').length,
  };
}
