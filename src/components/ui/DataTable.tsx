import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EmptyState, LoadingState } from './States';

export interface Column<T> {
  key: string;
  header: string;
  /** Contenu de la cellule. */
  render: (row: T) => ReactNode;
  /**
   * Valeur de tri. Absente, la colonne n'est pas triable — c'est le cas des
   * colonnes d'actions ou purement décoratives.
   */
  sortValue?: (row: T) => string | number;
  /** Aligne à droite et active les chiffres tabulaires. */
  numeric?: boolean;
  className?: string;
  /** Masque la colonne sous le point de rupture `md`. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Clé de la colonne triée par défaut. */
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  /**
   * Ligne de totaux. Construite par le tableau lui-même plutôt que fournie en
   * JSX : le pied doit émettre exactement une cellule par colonne, avec les
   * mêmes règles de masquage, sinon `colSpan` désaligne le total dès qu'une
   * colonne disparaît en mobile.
   */
  totalRow?: { label: string; value: string };
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  isLoading = false,
  emptyTitle = 'Aucune donnée',
  emptyDescription = 'Rien à afficher pour cette période.',
  emptyAction,
  defaultSortKey,
  defaultSortDirection = 'desc',
  totalRow,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [direction, setDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  const sortedRows = useMemo(() => {
    const column = columns.find((candidate) => candidate.key === sortKey);
    if (!column?.sortValue) return rows;

    const { sortValue } = column;
    return [...rows].sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);

      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), 'fr');

      return direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, columns, sortKey, direction]);

  const lastNumericKey = useMemo(
    () => [...columns].reverse().find((column) => column.numeric)?.key,
    [columns],
  );

  function toggleSort(column: Column<T>) {
    if (!column.sortValue) return;

    if (sortKey === column.key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key);
      setDirection('desc');
    }
  }

  if (isLoading) return <LoadingState />;

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="scrollbar-slim overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              const isSortable = Boolean(column.sortValue);

              return (
                <th
                  key={column.key}
                  scope="col"
                  data-numeric={column.numeric ? '' : undefined}
                  aria-sort={isSorted ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'px-4 py-2.5 text-left font-medium text-ink-2',
                    column.numeric && 'text-right',
                    column.hideOnMobile && 'hidden md:table-cell',
                    column.className,
                  )}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded transition-colors hover:text-ink',
                        column.numeric && 'flex-row-reverse',
                      )}
                    >
                      {column.header}
                      {isSorted ? (
                        direction === 'asc' ? (
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-line last:border-0 transition-colors hover:bg-surface-2/60"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-numeric={column.numeric ? '' : undefined}
                  className={cn(
                    'px-4 py-2.5 text-ink',
                    column.numeric && 'text-right',
                    column.hideOnMobile && 'hidden md:table-cell',
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {totalRow ? (
          <tfoot className="border-t border-line bg-surface-2/40">
            <tr>
              {columns.map((column, index) => {
                // Le libellé occupe la première colonne, le total la dernière
                // colonne numérique — la seule dont l'alignement à droite
                // correspond à un montant.
                const isLabelCell = index === 0;
                const isValueCell = column.key === lastNumericKey;

                return (
                  <td
                    key={column.key}
                    data-numeric={column.numeric ? '' : undefined}
                    className={cn(
                      'px-4 py-2.5',
                      column.numeric && 'text-right',
                      column.hideOnMobile && 'hidden md:table-cell',
                      isValueCell ? 'font-semibold text-ink' : 'text-ink-2',
                    )}
                  >
                    {isLabelCell ? totalRow.label : isValueCell ? totalRow.value : null}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
