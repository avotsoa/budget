import { useMemo, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { OwnerBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RowActions } from '@/components/ui/RowActions';
import { ErrorState } from '@/components/ui/States';
import { InvestmentForm } from '@/components/forms/InvestmentForm';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import { formatCurrency, formatDateShort, formatMonthLabel, formatSignedCurrency } from '@/lib/format';
import { INVESTMENT_TYPE_LABELS } from '@/lib/constants';
import { round2 } from '@/lib/finance/calculations';
import type { InvestmentRow, InvestmentType } from '@/types/database';

export function InvestmentsPage() {
  const { scoped, current, totals, deltas, portfolio, isLoading, error, refetch } = useFinanceData();
  const { ownerLabel, canWrite } = useHousehold();
  const { year, month } = useScope();
  const { remove } = useFinanceMutations('investments');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentRow | undefined>();

  /** Répartition du portefeuille par type d'actif, du plus lourd au plus léger. */
  const byType = useMemo(() => {
    const totalsByType = new Map<InvestmentType, { invested: number; value: number }>();

    for (const investment of scoped.investments) {
      const entry = totalsByType.get(investment.investment_type) ?? { invested: 0, value: 0 };
      entry.invested += Number(investment.invested_amount);
      entry.value += Number(investment.current_value);
      totalsByType.set(investment.investment_type, entry);
    }

    return Array.from(totalsByType.entries())
      .map(([type, entry]) => ({
        type,
        invested: round2(entry.invested),
        value: round2(entry.value),
        share: portfolio.value > 0 ? entry.value / portfolio.value : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [scoped.investments, portfolio.value]);

  const columns: Array<Column<InvestmentRow>> = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDateShort(row.date),
      sortValue: (row) => row.date,
    },
    {
      key: 'label',
      header: 'Support',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{row.label}</p>
          <p className="truncate text-xs text-ink-muted">
            {INVESTMENT_TYPE_LABELS[row.investment_type]}
          </p>
        </div>
      ),
      sortValue: (row) => row.label,
    },
    {
      key: 'owner',
      header: 'Propriétaire',
      render: (row) => <OwnerBadge owner={row.owner} label={ownerLabel(row.owner)} />,
      sortValue: (row) => ownerLabel(row.owner),
      hideOnMobile: true,
    },
    {
      key: 'invested',
      header: 'Investi',
      numeric: true,
      render: (row) => formatCurrency(Number(row.invested_amount)),
      sortValue: (row) => Number(row.invested_amount),
      hideOnMobile: true,
    },
    {
      key: 'gain',
      header: 'Plus-value',
      numeric: true,
      render: (row) => {
        const gain = round2(Number(row.current_value) - Number(row.invested_amount));
        return (
          <span
            className={
              gain > 0 ? 'text-delta-up' : gain < 0 ? 'text-delta-down' : 'text-ink-muted'
            }
          >
            {formatSignedCurrency(gain)}
          </span>
        );
      },
      sortValue: (row) => Number(row.current_value) - Number(row.invested_amount),
      hideOnMobile: true,
    },
    {
      key: 'value',
      header: 'Valeur',
      numeric: true,
      render: (row) => (
        <span className="font-medium text-ink">{formatCurrency(Number(row.current_value))}</span>
      ),
      sortValue: (row) => Number(row.current_value),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (row) => (
        <RowActions
          itemLabel={row.label}
          onEdit={() => {
            setEditing(row);
            setIsFormOpen(true);
          }}
          onDelete={() => remove.mutate(row.id)}
          isDeleting={remove.isPending}
        />
      ),
    },
  ];

  if (error) {
    return (
      <>
        <PageHeader title="Investissements" description="Portefeuille du foyer." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Investissements"
        description="Portefeuille consolidé et versements du mois."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(undefined);
                setIsFormOpen(true);
              }}
              leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Ajouter un investissement
            </Button>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Valeur du portefeuille"
          value={formatCurrency(portfolio.value)}
          hint="Toutes lignes visibles confondues"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
          emphasis
        />
        <KpiCard
          label="Total investi"
          value={formatCurrency(portfolio.invested)}
          hint="Somme des versements"
          isLoading={isLoading}
        />
        <KpiCard
          label="Plus-value"
          value={formatSignedCurrency(portfolio.gain)}
          hint={`${portfolio.gain >= 0 ? '+' : ''}${Math.round(portfolio.gainRatio * 1000) / 10} % de rendement`}
          isLoading={isLoading}
        />
        <KpiCard
          label="Investi ce mois-ci"
          value={formatCurrency(totals.totalInvested)}
          delta={deltas.investments}
          deltaDirection="up-is-good"
          isLoading={isLoading}
        />
      </div>

      {byType.length > 0 ? (
        <Card className="mb-5">
          <CardHeader
            title="Répartition par type d’actif"
            description="Part de chaque classe dans la valeur totale du portefeuille."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {byType.map((entry) => (
              <ProgressBar
                key={entry.type}
                value={entry.share}
                label={INVESTMENT_TYPE_LABELS[entry.type]}
                valueLabel={formatCurrency(entry.value)}
              />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={`Versements de ${formatMonthLabel(year, month)}`}
          description="Lignes investies sur la période affichée."
        />
        <DataTable
          rows={current.investments}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          defaultSortKey="date"
          emptyTitle="Aucun investissement ce mois-ci"
          emptyDescription={`Rien n’a été enregistré pour ${formatMonthLabel(year, month)}.`}
          emptyAction={
            canWrite ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(undefined);
                  setIsFormOpen(true);
                }}
                leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
              >
                Ajouter un investissement
              </Button>
            ) : undefined
          }
          totalRow={{
            label: `Total ${formatMonthLabel(year, month)}`,
            value: formatCurrency(
              round2(
                current.investments.reduce(
                  (sum, investment) => sum + Number(investment.current_value),
                  0,
                ),
              ),
            ),
          }}
        />
      </Card>

      <InvestmentForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        investment={editing}
      />
    </>
  );
}
