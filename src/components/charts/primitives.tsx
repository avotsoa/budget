import type { ReactNode } from 'react';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import type { SeriesSlot } from '@/lib/constants';

/**
 * Couleur d'une série. Les variables CSS fonctionnent dans les attributs de
 * présentation SVG : la bascule clair/sombre s'applique donc aux graphiques
 * sans qu'aucun composant ne relise le thème.
 */
export function seriesColor(slot: SeriesSlot): string {
  return `var(--series-${slot})`;
}

/** Chrome commun à tous les graphiques : grille et axes en filet plein, récessifs. */
export const CHART_CHROME = {
  grid: { stroke: 'var(--grid)', strokeWidth: 1 },
  axis: {
    stroke: 'var(--line-strong)',
    tick: { fill: 'var(--ink-muted)', fontSize: 12 },
    tickLine: false,
  },
} as const;

/** Marges laissant la place aux libellés d'axe — le graphique ne doit jamais défiler. */
export const CHART_MARGIN = { top: 8, right: 12, bottom: 4, left: 4 } as const;

export function currencyAxisFormatter(value: number): string {
  return formatCurrencyCompact(value);
}

interface TooltipEntry {
  name?: string | undefined;
  value?: number | string | undefined;
  color?: string | undefined;
  dataKey?: string | number | undefined;
}

interface ChartTooltipProps {
  active?: boolean | undefined;
  payload?: TooltipEntry[] | undefined;
  label?: string | number | undefined;
  /** Remplace le formatage monétaire par défaut. */
  formatter?: ((value: number) => string) | undefined;
}

/**
 * Infobulle commune. Le texte porte les jetons d'encre ; la pastille colorée
 * à côté du libellé porte l'identité de série — jamais le texte lui-même.
 */
export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const format = formatter ?? ((value: number) => formatCurrency(value));

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
      {label !== undefined ? (
        <p className="mb-1.5 text-xs font-medium text-ink">{label}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li
            key={`${String(entry.dataKey ?? index)}`}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="flex items-center gap-1.5 text-ink-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="tabular-nums font-medium text-ink">
              {typeof entry.value === 'number' ? format(entry.value) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LegendItem {
  label: string;
  color: string;
  /** Valeur affichée à droite du libellé — évite d'avoir à survoler. */
  value?: string;
}

/**
 * Légende explicite. Présente dès deux séries : l'identité ne doit jamais
 * reposer sur la seule mise en correspondance des couleurs.
 */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={className ?? 'mt-3 flex flex-wrap gap-x-4 gap-y-1.5'}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-ink-2">{item.label}</span>
          {item.value ? (
            <span className="tabular-nums font-medium text-ink">{item.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ChartFrame({ height, children }: { height: number; children: ReactNode }) {
  return <div style={{ height }}>{children}</div>;
}
