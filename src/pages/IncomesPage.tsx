import { useMemo, useState } from 'react';
import { ArrowUpCircle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { OwnerBadge } from '@/components/ui/Badge';
import { RowActions } from '@/components/ui/RowActions';
import { ErrorState } from '@/components/ui/States';
import { IncomeForm } from '@/components/forms/IncomeForm';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import { formatCurrency, formatDateShort, formatMonthLabel } from '@/lib/format';
import { INCOME_TYPE_LABELS } from '@/lib/constants';
import { computeOwnerBreakdown } from '@/lib/finance/calculations';
import type { IncomeRow } from '@/types/database';

export function IncomesPage() {
  const { current, totals, deltas, isLoading, error, refetch } = useFinanceData();
  const { ownerLabel, canWrite } = useHousehold();
  const { year, month } = useScope();
  const { remove } = useFinanceMutations('incomes');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | undefined>();

  const byOwner = useMemo(
    () => computeOwnerBreakdown(current.incomes.map((row) => ({ owner: row.owner, amount: row.amount }))),
    [current.incomes],
  );

  function openCreate() {
    setEditing(undefined);
    setIsFormOpen(true);
  }

  function openEdit(income: IncomeRow) {
    setEditing(income);
    setIsFormOpen(true);
  }

  const columns: Array<Column<IncomeRow>> = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDateShort(row.date),
      sortValue: (row) => row.date,
    },
    {
      key: 'label',
      header: 'Libellé',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{row.label || INCOME_TYPE_LABELS[row.income_type]}</p>
          {row.note ? <p className="truncate text-xs text-ink-muted">{row.note}</p> : null}
        </div>
      ),
      sortValue: (row) => row.label,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => INCOME_TYPE_LABELS[row.income_type],
      sortValue: (row) => INCOME_TYPE_LABELS[row.income_type],
      hideOnMobile: true,
    },
    {
      key: 'owner',
      header: 'Propriétaire',
      render: (row) => <OwnerBadge owner={row.owner} label={ownerLabel(row.owner)} />,
      sortValue: (row) => ownerLabel(row.owner),
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
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (row) => (
        <RowActions
          itemLabel={row.label || 'ce revenu'}
          onEdit={() => openEdit(row)}
          onDelete={() => remove.mutate(row.id)}
          isDeleting={remove.isPending}
        />
      ),
    },
  ];

  if (error) {
    return (
      <>
        <PageHeader title="Revenus" description="Toutes les entrées d’argent du foyer." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Revenus"
        description={`Entrées d’argent de ${formatMonthLabel(year, month)}.`}
        action={
          canWrite ? (
            <Button onClick={openCreate} leadingIcon={<Plus className="h-4 w-4" aria-hidden />}>
              Ajouter un revenu
            </Button>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total du mois"
          value={formatCurrency(totals.totalIncome)}
          delta={deltas.income}
          deltaDirection="up-is-good"
          icon={<ArrowUpCircle className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
          emphasis
        />

        {byOwner.map((entry) => (
          <KpiCard
            key={entry.owner}
            label={ownerLabel(entry.owner)}
            value={formatCurrency(entry.amount)}
            hint={`${Math.round(entry.share * 100)} % du total`}
            isLoading={isLoading}
          />
        ))}
      </div>

      <Card>
        <DataTable
          rows={current.incomes}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          defaultSortKey="date"
          emptyTitle="Aucun revenu ce mois-ci"
          emptyDescription={`Rien n’a été enregistré pour ${formatMonthLabel(year, month)}.`}
          emptyAction={
            canWrite ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={openCreate}
                leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
              >
                Ajouter un revenu
              </Button>
            ) : undefined
          }
          totalRow={{
            label: `Total ${formatMonthLabel(year, month)}`,
            value: formatCurrency(totals.totalIncome),
          }}
        />
      </Card>

      <IncomeForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        income={editing}
      />
    </>
  );
}
