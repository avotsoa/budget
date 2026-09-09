import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard, type TableView } from './ChartCard';
import {
  CHART_CHROME,
  CHART_MARGIN,
  ChartFrame,
  ChartLegend,
  ChartTooltip,
  currencyAxisFormatter,
  seriesColor,
} from './primitives';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { capitalize, formatCurrency, formatPercent } from '@/lib/format';
import { OWNER_SERIES_SLOT, SERIES_SLOTS, type SeriesSlot } from '@/lib/constants';
import { capCategories } from '@/lib/finance/calculations';
import type {
  CategoryBreakdown,
  ContributionBreakdown,
  MonthlyTotals,
  MonthlyTrendPoint,
} from '@/lib/finance/types';

/** Épaisseur maximale d'une barre — le reste de la bande reste de l'air. */
const MAX_BAR_SIZE = 24;

/** Une part-à-tout ne se lit d'un coup d'œil qu'en deçà de six tranches. */
const MAX_PIE_SLICES = 6;

// ---------------------------------------------------------------------------
// Dépenses par catégorie
// ---------------------------------------------------------------------------

export function CategoryPieChart({
  categories,
  isRefreshing,
}: {
  categories: CategoryBreakdown[];
  isRefreshing?: boolean;
}) {
  const slices = useMemo(() => capCategories(categories, MAX_PIE_SLICES), [categories]);
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

  const tableView: TableView = {
    columns: ['Catégorie', 'Montant', 'Part', 'Transactions'],
    numericColumns: [1, 2, 3],
    rows: slices.map((slice) => [
      slice.category,
      formatCurrency(slice.amount),
      formatPercent(slice.share),
      String(slice.transactionCount),
    ]),
  };

  return (
    <ChartCard
      title="Dépenses par catégorie"
      description="Répartition des transactions du mois affiché."
      tableView={tableView}
      isEmpty={slices.length === 0}
      isRefreshing={isRefreshing ?? false}
    >
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ChartFrame height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="amount"
                nameKey="category"
                innerRadius="55%"
                outerRadius="85%"
                // Le blanc sépare les tranches : jamais un contour, qui
                // ajouterait de l'encre non porteuse de donnée.
                stroke="var(--surface)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((slice, index) => (
                  <Cell
                    key={slice.category}
                    fill={seriesColor(SERIES_SLOTS[index % SERIES_SLOTS.length] as SeriesSlot)}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartFrame>

        <div>
          <p className="text-xs text-ink-2">Total du mois</p>
          <p className="text-xl font-semibold text-ink">{formatCurrency(total)}</p>
          <ChartLegend
            className="mt-3 space-y-1.5"
            items={slices.map((slice, index) => ({
              label: slice.category,
              color: seriesColor(SERIES_SLOTS[index % SERIES_SLOTS.length] as SeriesSlot),
              value: formatCurrency(slice.amount),
            }))}
          />
        </div>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Revenus vs sorties
// ---------------------------------------------------------------------------

export function IncomeVsExpenseChart({
  trend,
  isRefreshing,
}: {
  trend: MonthlyTrendPoint[];
  isRefreshing?: boolean;
}) {
  // Dépenses et factures sont deux flux distincts : les cumuler dans une même
  // barre « sorties » évite de laisser croire qu'elles se recoupent.
  const data = trend.map((point) => ({
    ...point,
    outflow: Math.round((point.expenses + point.bills) * 100) / 100,
  }));

  const tableView: TableView = {
    columns: ['Mois', 'Revenus', 'Dépenses', 'Factures', 'Solde'],
    numericColumns: [1, 2, 3, 4],
    rows: data.map((point) => [
      capitalize(point.label),
      formatCurrency(point.income),
      formatCurrency(point.expenses),
      formatCurrency(point.bills),
      formatCurrency(point.balance),
    ]),
  };

  const hasData = data.some((point) => point.income > 0 || point.outflow > 0);

  return (
    <ChartCard
      title="Revenus et sorties par mois"
      description="Les sorties agrègent dépenses et factures, sur la même échelle que les revenus."
      tableView={tableView}
      isEmpty={!hasData}
      isRefreshing={isRefreshing ?? false}
    >
      <ChartFrame height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN} barGap={2}>
            <CartesianGrid vertical={false} {...CHART_CHROME.grid} />
            <XAxis dataKey="label" {...CHART_CHROME.axis} />
            <YAxis tickFormatter={currencyAxisFormatter} width={56} {...CHART_CHROME.axis} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar
              dataKey="income"
              name="Revenus"
              fill={seriesColor(1)}
              maxBarSize={MAX_BAR_SIZE}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="outflow"
              name="Sorties"
              fill={seriesColor(2)}
              maxBarSize={MAX_BAR_SIZE}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartLegend
        items={[
          { label: 'Revenus', color: seriesColor(1) },
          { label: 'Sorties (dépenses + factures)', color: seriesColor(2) },
        ]}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Évolution de l'épargne
// ---------------------------------------------------------------------------

export function SavingsTrendChart({
  trend,
  isRefreshing,
}: {
  trend: MonthlyTrendPoint[];
  isRefreshing?: boolean;
}) {
  const tableView: TableView = {
    columns: ['Mois', 'Épargne du mois', 'Épargne cumulée'],
    numericColumns: [1, 2],
    rows: trend.map((point) => [
      capitalize(point.label),
      formatCurrency(point.savings),
      formatCurrency(point.cumulativeSavings),
    ]),
  };

  const hasData = trend.some((point) => point.cumulativeSavings !== 0);

  return (
    <ChartCard
      title="Évolution de l’épargne"
      description="Cumul des versements, retraits déduits."
      tableView={tableView}
      isEmpty={!hasData}
      isRefreshing={isRefreshing ?? false}
    >
      <ChartFrame height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} {...CHART_CHROME.grid} />
            <XAxis dataKey="label" {...CHART_CHROME.axis} />
            <YAxis tickFormatter={currencyAxisFormatter} width={56} {...CHART_CHROME.axis} />
            <Tooltip content={<ChartTooltip />} />
            {/* Série unique : la légende serait une redite du titre. */}
            <Line
              type="monotone"
              dataKey="cumulativeSavings"
              name="Épargne cumulée"
              stroke={seriesColor(3)}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Évolution des investissements
// ---------------------------------------------------------------------------

export function InvestmentTrendChart({
  trend,
  isRefreshing,
}: {
  trend: MonthlyTrendPoint[];
  isRefreshing?: boolean;
}) {
  const tableView: TableView = {
    columns: ['Mois', 'Investi cumulé', 'Valeur cumulée'],
    numericColumns: [1, 2],
    rows: trend.map((point) => [
      capitalize(point.label),
      formatCurrency(point.cumulativeInvested),
      formatCurrency(point.cumulativeValue),
    ]),
  };

  const hasData = trend.some((point) => point.cumulativeInvested > 0);

  return (
    <ChartCard
      title="Évolution des investissements"
      description="Montant investi et valeur du portefeuille, tous deux en euros sur une seule échelle."
      tableView={tableView}
      isEmpty={!hasData}
      isRefreshing={isRefreshing ?? false}
    >
      <ChartFrame height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} {...CHART_CHROME.grid} />
            <XAxis dataKey="label" {...CHART_CHROME.axis} />
            <YAxis tickFormatter={currencyAxisFormatter} width={56} {...CHART_CHROME.axis} />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="cumulativeInvested"
              name="Investi"
              stroke={seriesColor(1)}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cumulativeValue"
              name="Valeur"
              stroke={seriesColor(2)}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartLegend
        items={[
          { label: 'Montant investi', color: seriesColor(1) },
          { label: 'Valeur du portefeuille', color: seriesColor(2) },
        ]}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Charges fixes vs variables
// ---------------------------------------------------------------------------

export function FixedVsVariableChart({
  totals,
  isRefreshing,
}: {
  totals: MonthlyTotals;
  isRefreshing?: boolean;
}) {
  const data = [
    { label: 'Charges fixes', amount: Math.round((totals.fixedExpenses + totals.totalBills) * 100) / 100, slot: 1 as SeriesSlot },
    { label: 'Dépenses variables', amount: totals.variableExpenses, slot: 2 as SeriesSlot },
  ];

  const total = data.reduce((sum, item) => sum + item.amount, 0);

  const tableView: TableView = {
    columns: ['Nature', 'Montant', 'Part'],
    numericColumns: [1, 2],
    rows: data.map((item) => [
      item.label,
      formatCurrency(item.amount),
      formatPercent(total > 0 ? item.amount / total : 0),
    ]),
  };

  return (
    <ChartCard
      title="Charges fixes et dépenses variables"
      description="Les charges fixes regroupent les dépenses récurrentes et les factures."
      tableView={tableView}
      isEmpty={total === 0}
      isRefreshing={isRefreshing ?? false}
    >
      <ChartFrame height={180}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ ...CHART_MARGIN, left: 8 }}>
            <CartesianGrid horizontal={false} {...CHART_CHROME.grid} />
            <XAxis type="number" tickFormatter={currencyAxisFormatter} {...CHART_CHROME.axis} />
            <YAxis type="category" dataKey="label" width={140} {...CHART_CHROME.axis} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="amount" name="Montant" maxBarSize={MAX_BAR_SIZE} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((item) => (
                <Cell key={item.label} fill={seriesColor(item.slot)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <p className="mt-2 text-xs text-ink-2">
        Les charges fixes représentent{' '}
        <span className="font-medium text-ink">{formatPercent(totals.fixedChargeRatio)}</span> des
        revenus du mois.
      </p>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Contributions des partenaires
// ---------------------------------------------------------------------------

export function ContributionChart({
  contributions,
  labelFor,
  isRefreshing,
}: {
  contributions: ContributionBreakdown[];
  labelFor: (slot: 'partnerA' | 'partnerB') => string;
  isRefreshing?: boolean;
}) {
  const data = contributions.map((entry) => ({
    label: labelFor(entry.slot),
    paid: entry.paidAmount,
    income: entry.income,
    slot: OWNER_SERIES_SLOT[entry.slot],
  }));

  const tableView: TableView = {
    columns: ['Partenaire', 'A payé', 'Part des dépenses', 'Revenus', 'Part des revenus'],
    numericColumns: [1, 2, 3, 4],
    rows: contributions.map((entry) => [
      labelFor(entry.slot),
      formatCurrency(entry.paidAmount),
      formatPercent(entry.paidShare),
      formatCurrency(entry.income),
      formatPercent(entry.incomeShare),
    ]),
  };

  const hasData = data.some((item) => item.paid > 0 || item.income > 0);

  return (
    <ChartCard
      title="Contribution de chacun"
      description="Montants réellement décaissés, factures communes réparties à parts égales."
      tableView={tableView}
      isEmpty={!hasData}
      isRefreshing={isRefreshing ?? false}
    >
      <ChartFrame height={200}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN} barGap={2}>
            <CartesianGrid vertical={false} {...CHART_CHROME.grid} />
            <XAxis dataKey="label" {...CHART_CHROME.axis} />
            <YAxis tickFormatter={currencyAxisFormatter} width={56} {...CHART_CHROME.axis} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar
              dataKey="income"
              name="Revenus"
              fill={seriesColor(1)}
              maxBarSize={MAX_BAR_SIZE}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="paid"
              name="A payé"
              fill={seriesColor(2)}
              maxBarSize={MAX_BAR_SIZE}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartLegend
        items={[
          { label: 'Revenus', color: seriesColor(1) },
          { label: 'Dépenses réglées', color: seriesColor(2) },
        ]}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------
// Taux d'épargne — une jauge, pas un graphique : la donnée est un seul nombre.
// ---------------------------------------------------------------------------

export function SavingsRateGauge({ totals }: { totals: MonthlyTotals }) {
  const rate = totals.savingsRate;

  const assessment =
    rate >= 0.2
      ? 'Excellent rythme d’épargne.'
      : rate >= 0.1
        ? 'Rythme correct, proche des repères usuels.'
        : rate > 0
          ? 'Rythme faible : marge de progression.'
          : 'Aucune épargne enregistrée ce mois-ci.';

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <p className="text-sm text-ink-2">Taux d’épargne du mois</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{formatPercent(rate)}</p>
      <p className="mt-1 text-sm text-ink-2">{assessment}</p>

      <div className="mt-4">
        {/* Repère à 20 % du revenu, valeur souvent citée comme objectif. */}
        <ProgressBar value={rate / 0.2} valueLabel={`${formatCurrency(totals.totalSavings)} épargnés`} />
        <p className="mt-1 text-xs text-ink-muted">Progression vers un objectif de 20 % des revenus.</p>
      </div>
    </div>
  );
}
