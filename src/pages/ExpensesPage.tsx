import { useMemo, useState } from 'react';
import { ArrowDownCircle, Plus, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { Badge, OwnerBadge } from '@/components/ui/Badge';
import { RowActions } from '@/components/ui/RowActions';
import { ErrorState } from '@/components/ui/States';
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import { formatCurrency, formatDateShort, formatMonthLabel } from '@/lib/format';
import { EXPENSE_CATEGORIES, EXPENSE_KIND_LABELS, OWNER_SLOTS } from '@/lib/constants';
import { round2 } from '@/lib/finance/calculations';
import type { ExpenseKind, ExpenseRow, OwnerSlot } from '@/types/database';

type CategoryFilter = string | 'all';
type OwnerFilter = OwnerSlot | 'all';
type KindFilter = ExpenseKind | 'all';

export function ExpensesPage() {
  const { current, totals, deltas, isLoading, error, refetch } = useFinanceData();
  const { ownerLabel, canWrite } = useHousehold();
  const { year, month } = useScope();
  const { remove } = useFinanceMutations('expenses');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | undefined>();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [owner, setOwner] = useState<OwnerFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');

  const hasActiveFilter =
    search.trim() !== '' || category !== 'all' || owner !== 'all' || kind !== 'all';

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return current.expenses.filter((expense) => {
      if (category !== 'all' && expense.category !== category) return false;
      if (owner !== 'all' && expense.owner !== owner) return false;
      if (kind !== 'all' && expense.kind !== kind) return false;

      if (needle) {
        const haystack = [expense.label, expense.category, expense.subcategory, expense.note]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [current.expenses, search, category, owner, kind]);

  const filteredTotal = useMemo(
    () => round2(filtered.reduce((sum, expense) => sum + Number(expense.amount), 0)),
    [filtered],
  );

  function openCreate() {
    setEditing(undefined);
    setIsFormOpen(true);
  }

  function resetFilters() {
    setSearch('');
    setCategory('all');
    setOwner('all');
    setKind('all');
  }

  const columns: Array<Column<ExpenseRow>> = [
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
          <p className="truncate text-ink">{row.label || row.category}</p>
          <p className="truncate text-xs text-ink-muted">
            {row.category}
            {row.subcategory ? ` · ${row.subcategory}` : ''}
          </p>
        </div>
      ),
      sortValue: (row) => row.label || row.category,
    },
    {
      key: 'kind',
      header: 'Type',
      render: (row) => (
        <Badge tone={row.kind === 'fixed' ? 'brand' : 'neutral'}>
          {EXPENSE_KIND_LABELS[row.kind]}
        </Badge>
      ),
      sortValue: (row) => EXPENSE_KIND_LABELS[row.kind],
      hideOnMobile: true,
    },
    {
      key: 'paid_by',
      header: 'Payé par',
      render: (row) => <OwnerBadge owner={row.paid_by} label={ownerLabel(row.paid_by)} />,
      sortValue: (row) => ownerLabel(row.paid_by),
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
          itemLabel={row.label || row.category}
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
        <PageHeader title="Dépenses" description="Toutes les transactions du foyer." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dépenses"
        description={`Transactions de ${formatMonthLabel(year, month)}, hors factures récurrentes.`}
        action={
          canWrite ? (
            <Button onClick={openCreate} leadingIcon={<Plus className="h-4 w-4" aria-hidden />}>
              Ajouter une dépense
            </Button>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total du mois"
          value={formatCurrency(totals.totalExpenses)}
          delta={deltas.expenses}
          deltaDirection="down-is-good"
          icon={<ArrowDownCircle className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
          emphasis
        />
        <KpiCard
          label="Charges fixes"
          value={formatCurrency(totals.fixedExpenses)}
          hint="Abonnements et dépenses récurrentes"
          isLoading={isLoading}
        />
        <KpiCard
          label="Dépenses variables"
          value={formatCurrency(totals.variableExpenses)}
          hint="Courses, loisirs, imprévus"
          isLoading={isLoading}
        />
        <KpiCard
          label="Moyenne journalière"
          value={formatCurrency(totals.dailyAverageExpense)}
          hint="Sur les jours écoulés du mois"
          isLoading={isLoading}
        />
      </div>

      <Card>
        {/* Filtres sur une seule ligne au-dessus du tableau. */}
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="expense-search" className="mb-1.5 block text-sm font-medium text-ink">
              Rechercher
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                id="expense-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Libellé, catégorie, note…"
                className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <FilterSelect
            id="expense-category"
            label="Catégorie"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: 'Toutes' },
              ...EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item })),
            ]}
          />

          <FilterSelect
            id="expense-owner"
            label="Propriétaire"
            value={owner}
            onChange={(value) => setOwner(value as OwnerFilter)}
            options={[
              { value: 'all', label: 'Tous' },
              ...OWNER_SLOTS.map((slot) => ({ value: slot, label: ownerLabel(slot) })),
            ]}
          />

          <FilterSelect
            id="expense-kind"
            label="Type"
            value={kind}
            onChange={(value) => setKind(value as KindFilter)}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'fixed', label: 'Fixe' },
              { value: 'variable', label: 'Variable' },
            ]}
          />

          {hasActiveFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              leadingIcon={<X className="h-3.5 w-3.5" aria-hidden />}
            >
              Réinitialiser
            </Button>
          ) : null}
        </div>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          defaultSortKey="date"
          emptyTitle={hasActiveFilter ? 'Aucun résultat' : 'Aucune dépense ce mois-ci'}
          emptyDescription={
            hasActiveFilter
              ? 'Aucune dépense ne correspond aux filtres actifs.'
              : `Rien n’a été enregistré pour ${formatMonthLabel(year, month)}.`
          }
          emptyAction={
            hasActiveFilter ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            ) : canWrite ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={openCreate}
                leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
              >
                Ajouter une dépense
              </Button>
            ) : undefined
          }
          totalRow={{
            label: hasActiveFilter
              ? `Total filtré (${filtered.length} ligne${filtered.length > 1 ? 's' : ''})`
              : `Total ${formatMonthLabel(year, month)}`,
            value: formatCurrency(filteredTotal),
          }}
        />
      </Card>

      <ExpenseForm open={isFormOpen} onClose={() => setIsFormOpen(false)} expense={editing} />
    </>
  );
}

interface FilterSelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: string; label: string }>;
}

function FilterSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: FilterSelectProps<T>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
