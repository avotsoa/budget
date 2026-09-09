import { useMemo } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { OwnerBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorState } from '@/components/ui/States';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import {
  capitalize,
  formatCurrency,
  formatDateShort,
  formatMonthLabel,
  formatPercent,
  formatSignedCurrency,
} from '@/lib/format';
import {
  mostExpensiveCategory,
  potentialSavings,
  topExpenses,
  unusualExpenses,
} from '@/lib/finance/calculations';
import type { ExpenseRow } from '@/types/database';

export function SummaryPage() {
  const { current, totals, previousTotals, deltas, categories, isLoading, error, refetch } =
    useFinanceData();
  const { ownerLabel } = useHousehold();
  const { year, month } = useScope();

  const top = useMemo(() => topExpenses(current, 5), [current]);
  const unusual = useMemo(() => unusualExpenses(current), [current]);
  const costliest = useMemo(() => mostExpensiveCategory(current), [current]);
  const savingsOpportunity = useMemo(() => potentialSavings(current), [current]);

  const analysis = useMemo(
    () =>
      buildAnalysis({
        totals,
        previousBalance: previousTotals.monthlyBalance,
        costliestCategory: costliest?.category ?? null,
        costliestAmount: costliest?.amount ?? 0,
        unusualCount: unusual.length,
        savingsOpportunity,
      }),
    [totals, previousTotals.monthlyBalance, costliest, unusual.length, savingsOpportunity],
  );

  const expenseColumns: Array<Column<ExpenseRow>> = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDateShort(row.date),
      sortValue: (row) => row.date,
    },
    {
      key: 'label',
      header: 'Dépense',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{row.label || row.category}</p>
          <p className="truncate text-xs text-ink-muted">{row.category}</p>
        </div>
      ),
      sortValue: (row) => row.label,
    },
    {
      key: 'paid_by',
      header: 'Payé par',
      render: (row) => <OwnerBadge owner={row.paid_by} label={ownerLabel(row.paid_by)} />,
      sortValue: (row) => ownerLabel(row.paid_by),
      hideOnMobile: true,
    },
    {
      key: 'amount',
      header: 'Montant',
      numeric: true,
      render: (row) => (
        <span className="font-medium text-ink">{formatCurrency(Number(row.amount))}</span>
      ),
      sortValue: (row) => Number(row.amount),
    },
  ];

  if (error) {
    return (
      <>
        <PageHeader title="Synthèse" description="Résumé automatique du mois." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const lines = [
    { label: 'Revenus', value: totals.totalIncome, tone: 'positive' as const },
    { label: 'Dépenses fixes', value: -totals.fixedExpenses, tone: 'negative' as const },
    { label: 'Dépenses variables', value: -totals.variableExpenses, tone: 'negative' as const },
    { label: 'Factures', value: -totals.totalBills, tone: 'negative' as const },
    { label: 'Épargne', value: -totals.totalSavings, tone: 'neutral' as const },
    { label: 'Investissements', value: -totals.totalInvested, tone: 'neutral' as const },
  ];

  return (
    <>
      <PageHeader
        title="Synthèse"
        description={`Résumé automatique de ${formatMonthLabel(year, month)}.`}
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={`Compte du mois — ${capitalize(formatMonthLabel(year, month))}`}
            description="Du revenu au reste à vivre, ligne par ligne."
          />
          <CardBody>
            <dl className="divide-y divide-[color:var(--line)]">
              {lines.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-sm text-ink-2">{line.label}</dt>
                  <dd
                    className={
                      line.tone === 'positive'
                        ? 'tabular-nums font-medium text-delta-up'
                        : 'tabular-nums font-medium text-ink'
                    }
                  >
                    {formatSignedCurrency(line.value)}
                  </dd>
                </div>
              ))}

              <div className="flex items-center justify-between gap-4 pt-3">
                <dt className="font-medium text-ink">Reste à vivre</dt>
                <dd
                  className={
                    totals.remainingToLive < 0
                      ? 'text-lg font-semibold tabular-nums text-delta-down'
                      : 'text-lg font-semibold tabular-nums text-ink'
                  }
                >
                  {formatCurrency(totals.remainingToLive)}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Analyse du mois" description="Lecture automatique des chiffres." />
          <CardBody>
            <div className="mb-3 flex items-center gap-2 text-brand">
              <Sparkles className="h-4 w-4" aria-hidden />
              <span className="text-sm font-medium">Ce qu’il faut retenir</span>
            </div>
            <ul className="space-y-2.5">
              {analysis.map((sentence) => (
                <li key={sentence} className="flex gap-2 text-sm text-ink-2">
                  <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
                  {sentence}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top catégories de dépenses"
            description="Les postes les plus lourds du mois."
          />
          <CardBody className="space-y-4">
            {categories.length === 0 ? (
              <p className="text-sm text-ink-2">Aucune dépense enregistrée ce mois-ci.</p>
            ) : (
              categories
                .slice(0, 5)
                .map((category) => (
                  <ProgressBar
                    key={category.category}
                    value={category.share}
                    label={category.category}
                    valueLabel={`${formatCurrency(category.amount)} · ${category.transactionCount} op.`}
                  />
                ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Dépenses inhabituelles"
            description="Montants dépassant trois fois la dépense médiane du mois."
          />
          {unusual.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-2">
                Aucune dépense hors norme détectée. Les montants du mois restent homogènes.
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {unusual.slice(0, 5).map((expense) => (
                <li key={expense.id} className="flex items-center gap-3 px-5 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {expense.label || expense.category}
                    </p>
                    <p className="text-xs text-ink-2">
                      {expense.category} · {formatDateShort(expense.date)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-ink">
                    {formatCurrency(Number(expense.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Les plus grosses dépenses"
          description="Cinq premières transactions du mois par montant."
        />
        <DataTable
          rows={top}
          columns={expenseColumns}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          defaultSortKey="amount"
          emptyTitle="Aucune dépense ce mois-ci"
          emptyDescription={`Rien n’a été enregistré pour ${formatMonthLabel(year, month)}.`}
        />
      </Card>

      <p className="mt-4 text-xs text-ink-muted">
        Variation du solde par rapport au mois précédent :{' '}
        {deltas.balance.ratio === null
          ? 'référence indisponible'
          : `${formatSignedCurrency(deltas.balance.absolute)} (${formatPercent(deltas.balance.ratio)})`}
        .
      </p>
    </>
  );
}

interface AnalysisInput {
  totals: {
    totalIncome: number;
    totalExpenses: number;
    totalBills: number;
    totalSavings: number;
    savingsRate: number;
    fixedChargeRatio: number;
    remainingToLive: number;
    dailyAverageExpense: number;
  };
  previousBalance: number;
  costliestCategory: string | null;
  costliestAmount: number;
  unusualCount: number;
  savingsOpportunity: number;
}

/**
 * Analyse textuelle du mois.
 *
 * Règles déterministes appliquées aux chiffres déjà calculés — aucune part
 * d'invention : chaque phrase renvoie à une valeur affichée ailleurs sur la page.
 */
function buildAnalysis(input: AnalysisInput): string[] {
  const { totals, previousBalance, costliestCategory, costliestAmount, unusualCount } = input;
  const sentences: string[] = [];

  if (totals.totalIncome === 0) {
    return ['Aucun revenu enregistré ce mois-ci : la synthèse reste partielle.'];
  }

  if (totals.remainingToLive < 0) {
    sentences.push(
      `Le mois est déficitaire de ${formatCurrency(Math.abs(totals.remainingToLive))} : les sorties dépassent les revenus.`,
    );
  } else {
    sentences.push(
      `Il reste ${formatCurrency(totals.remainingToLive)} après charges, épargne et investissements.`,
    );
  }

  if (totals.savingsRate > 0) {
    sentences.push(
      `Vous avez mis de côté ${formatPercent(totals.savingsRate)} de vos revenus, soit ${formatCurrency(totals.totalSavings)}.`,
    );
  } else {
    sentences.push('Aucune épargne n’a été enregistrée sur la période.');
  }

  if (totals.fixedChargeRatio > 0.5) {
    sentences.push(
      `Les charges fixes pèsent ${formatPercent(totals.fixedChargeRatio)} des revenus — au-delà du repère usuel d’un tiers.`,
    );
  } else if (totals.fixedChargeRatio > 0) {
    sentences.push(
      `Les charges fixes représentent ${formatPercent(totals.fixedChargeRatio)} des revenus.`,
    );
  }

  if (costliestCategory) {
    sentences.push(
      `Le poste le plus lourd est « ${costliestCategory} » avec ${formatCurrency(costliestAmount)}.`,
    );
  }

  if (totals.dailyAverageExpense > 0) {
    sentences.push(
      `La dépense moyenne s’établit à ${formatCurrency(totals.dailyAverageExpense)} par jour écoulé.`,
    );
  }

  if (unusualCount > 0) {
    sentences.push(
      `${unusualCount} dépense(s) sortent nettement de l’ordinaire et expliquent une partie du total.`,
    );
  }

  if (input.savingsOpportunity > 0) {
    sentences.push(
      `Tenir vos plafonds de catégorie aurait permis d’économiser ${formatCurrency(input.savingsOpportunity)}.`,
    );
  }

  if (previousBalance !== 0) {
    const difference = totals.remainingToLive - previousBalance;
    sentences.push(
      difference >= 0
        ? `Le solde s’améliore de ${formatCurrency(difference)} par rapport au mois précédent.`
        : `Le solde recule de ${formatCurrency(Math.abs(difference))} par rapport au mois précédent.`,
    );
  }

  return sentences;
}
