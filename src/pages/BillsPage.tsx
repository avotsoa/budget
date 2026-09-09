import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { BillStatusBadge, OwnerBadge } from '@/components/ui/Badge';
import { RowActions } from '@/components/ui/RowActions';
import { ErrorState } from '@/components/ui/States';
import { BillForm } from '@/components/forms/BillForm';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import { daysUntil, formatCurrency, formatDateShort, formatMonthLabel } from '@/lib/format';
import { ALERT_THRESHOLDS, BILL_FREQUENCY_LABELS } from '@/lib/constants';
import type { BillRow } from '@/types/database';

export function BillsPage() {
  const { current, totals, deltas, isLoading, error, refetch } = useFinanceData();
  const { ownerLabel, canWrite } = useHousehold();
  const { year, month } = useScope();
  const { remove, update } = useFinanceMutations('bills');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<BillRow | undefined>();

  /** Échéances à traiter : en retard d'abord, puis les plus proches. */
  const upcoming = useMemo(
    () =>
      current.bills
        .filter((bill) => bill.status !== 'paid')
        .filter(
          (bill) =>
            bill.status === 'overdue' || daysUntil(bill.date) <= ALERT_THRESHOLDS.billDueSoonDays,
        )
        .sort((a, b) => daysUntil(a.date) - daysUntil(b.date)),
    [current.bills],
  );

  const paidCount = current.bills.filter((bill) => bill.status === 'paid').length;

  function markAsPaid(bill: BillRow) {
    update.mutate({ id: bill.id, values: { status: 'paid' } });
  }

  const columns: Array<Column<BillRow>> = [
    {
      key: 'date',
      header: 'Échéance',
      render: (row) => {
        const remaining = daysUntil(row.date);
        return (
          <div>
            <p className="text-ink">{formatDateShort(row.date)}</p>
            {row.status !== 'paid' ? (
              <p className="text-xs text-ink-muted">
                {remaining < 0
                  ? `En retard de ${Math.abs(remaining)} j`
                  : remaining === 0
                    ? 'Aujourd’hui'
                    : `Dans ${remaining} j`}
              </p>
            ) : null}
          </div>
        );
      },
      sortValue: (row) => row.date,
    },
    {
      key: 'label',
      header: 'Facture',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{row.label}</p>
          <p className="truncate text-xs text-ink-muted">
            {row.category} · {BILL_FREQUENCY_LABELS[row.frequency]}
          </p>
        </div>
      ),
      sortValue: (row) => row.label,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <BillStatusBadge status={row.status} />,
      sortValue: (row) => row.status,
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
      className: 'w-28',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canWrite && row.status !== 'paid' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => markAsPaid(row)}
              aria-label={`Marquer ${row.label} comme payée`}
              className="hover:text-good"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
          <RowActions
            itemLabel={row.label}
            onEdit={() => {
              setEditing(row);
              setIsFormOpen(true);
            }}
            onDelete={() => remove.mutate(row.id)}
            isDeleting={remove.isPending}
          />
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <>
        <PageHeader title="Factures" description="Charges récurrentes du foyer." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Factures"
        description={`Charges récurrentes de ${formatMonthLabel(year, month)}.`}
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(undefined);
                setIsFormOpen(true);
              }}
              leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Ajouter une facture
            </Button>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total des factures"
          value={formatCurrency(totals.totalBills)}
          delta={deltas.bills}
          deltaDirection="down-is-good"
          icon={<Receipt className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
          emphasis
        />
        <KpiCard
          label="Reste à payer"
          value={formatCurrency(totals.unpaidBills)}
          hint={`${current.bills.length - paidCount} facture(s) en attente`}
          isLoading={isLoading}
        />
        <KpiCard
          label="Déjà réglé"
          value={formatCurrency(totals.totalBills - totals.unpaidBills)}
          hint={`${paidCount} facture(s) payée(s)`}
          isLoading={isLoading}
        />
        <KpiCard
          label="Part des revenus"
          value={
            totals.totalIncome > 0
              ? `${Math.round((totals.totalBills / totals.totalIncome) * 100)} %`
              : '—'
          }
          hint="Poids des factures sur les revenus"
          isLoading={isLoading}
        />
      </div>

      {upcoming.length > 0 ? (
        <Card className="mb-5 border-warning/40">
          <CardHeader
            title="Échéances à traiter"
            description="Factures en retard ou arrivant à échéance sous 7 jours."
          />
          <ul className="divide-y divide-[color:var(--line)]">
            {upcoming.map((bill) => {
              const remaining = daysUntil(bill.date);
              const isLate = bill.status === 'overdue' || remaining < 0;

              return (
                <li key={bill.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <AlertTriangle
                    className={isLate ? 'h-4 w-4 shrink-0 text-critical' : 'h-4 w-4 shrink-0 text-warning'}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{bill.label}</p>
                    <p className="text-xs text-ink-2">
                      {isLate
                        ? `En retard de ${Math.abs(remaining)} jour(s)`
                        : remaining === 0
                          ? 'À régler aujourd’hui'
                          : `À régler dans ${remaining} jour(s)`}{' '}
                      · {ownerLabel(bill.owner)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-ink">
                    {formatCurrency(Number(bill.amount))}
                  </span>
                  {canWrite ? (
                    <Button variant="secondary" size="sm" onClick={() => markAsPaid(bill)}>
                      Marquer payée
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <DataTable
          rows={current.bills}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          defaultSortKey="date"
          defaultSortDirection="asc"
          emptyTitle="Aucune facture ce mois-ci"
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
                Ajouter une facture
              </Button>
            ) : undefined
          }
          totalRow={{
            label: `Total ${formatMonthLabel(year, month)}`,
            value: formatCurrency(totals.totalBills),
          }}
        />
      </Card>

      <BillForm open={isFormOpen} onClose={() => setIsFormOpen(false)} bill={editing} />
    </>
  );
}
