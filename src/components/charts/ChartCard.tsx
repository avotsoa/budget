import { useState, type ReactNode } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';

export interface TableView {
  columns: string[];
  rows: string[][];
  /** Index des colonnes à aligner à droite (montants). */
  numericColumns?: number[];
}

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  /**
   * Équivalent tabulaire du graphique. Obligatoire : aucune valeur ne doit
   * être accessible uniquement par la couleur ou l'infobulle.
   */
  tableView: TableView;
  /** Vrai quand il n'y a rien à tracer. */
  isEmpty?: boolean;
  emptyDescription?: string;
  /** Atténue le rendu pendant un rechargement, sans squelette ni saut de mise en page. */
  isRefreshing?: boolean;
  className?: string;
}

export function ChartCard({
  title,
  description,
  children,
  tableView,
  isEmpty = false,
  emptyDescription = 'Aucune donnée sur la période sélectionnée.',
  isRefreshing = false,
  className,
}: ChartCardProps) {
  const [mode, setMode] = useState<'chart' | 'table'>('chart');

  return (
    <Card className={className}>
      <CardHeader
        title={title}
        {...(description ? { description } : {})}
        action={
          !isEmpty ? (
            <div
              role="radiogroup"
              aria-label="Mode d’affichage"
              className="flex gap-0.5 rounded-lg border border-line p-0.5"
            >
              <ModeButton
                isActive={mode === 'chart'}
                onClick={() => setMode('chart')}
                label="Graphique"
                icon={<BarChart3 className="h-3.5 w-3.5" aria-hidden />}
              />
              <ModeButton
                isActive={mode === 'table'}
                onClick={() => setMode('table')}
                label="Tableau"
                icon={<Table2 className="h-3.5 w-3.5" aria-hidden />}
              />
            </div>
          ) : null
        }
      />

      {isEmpty ? (
        <EmptyState title="Rien à afficher" description={emptyDescription} />
      ) : mode === 'chart' ? (
        <div
          className={cn(
            'p-4 transition-opacity',
            // Pas de squelette au rechargement : on garde le rendu précédent
            // atténué, ce qui évite le clignotement et le saut de hauteur.
            isRefreshing && 'opacity-60',
          )}
        >
          {children}
        </div>
      ) : (
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                {tableView.columns.map((column, index) => (
                  <th
                    key={column}
                    scope="col"
                    data-numeric={tableView.numericColumns?.includes(index) ? '' : undefined}
                    className={cn(
                      'px-4 py-2.5 text-left font-medium text-ink-2',
                      tableView.numericColumns?.includes(index) && 'text-right',
                    )}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableView.rows.map((row) => (
                <tr key={row.join('|')} className="border-b border-line last:border-0">
                  {row.map((cell, index) => (
                    <td
                      key={`${index}-${cell}`}
                      data-numeric={tableView.numericColumns?.includes(index) ? '' : undefined}
                      className={cn(
                        'px-4 py-2.5 text-ink',
                        tableView.numericColumns?.includes(index) && 'text-right',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ModeButton({
  isActive,
  onClick,
  label,
  icon,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink',
      )}
    >
      {icon}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}
