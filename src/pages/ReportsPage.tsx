import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { KpiCard } from '@/components/ui/KpiCard';
import {
  CategoryPieChart,
  ContributionChart,
  FixedVsVariableChart,
  IncomeVsExpenseChart,
  InvestmentTrendChart,
  SavingsRateGauge,
  SavingsTrendChart,
} from '@/components/charts/FinanceCharts';
import { useFinanceData, TREND_MONTHS } from '@/hooks/useFinanceData';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import { formatCurrency, formatMonthLabel, formatPercent } from '@/lib/format';
import { SCOPE_LABELS } from '@/lib/constants';
import { mostExpensiveCategory, potentialSavings } from '@/lib/finance/calculations';

export function ReportsPage() {
  const {
    current,
    totals,
    trend,
    categories,
    contributions,
    portfolio,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useFinanceData();
  const { ownerLabel } = useHousehold();
  const { year, month, scope } = useScope();

  if (error) {
    return (
      <>
        <PageHeader title="Rapports" description="Analyses et visualisations." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  const costliest = mostExpensiveCategory(current);
  const opportunity = potentialSavings(current);
  const isRefreshing = isFetching && !isLoading;

  return (
    <>
      <PageHeader
        title="Rapports"
        description={`${TREND_MONTHS} mois d’historique jusqu’à ${formatMonthLabel(year, month)} · ${SCOPE_LABELS[scope]}`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Catégorie la plus coûteuse"
          value={costliest?.category ?? '—'}
          hint={costliest ? formatCurrency(costliest.amount) : 'Aucune dépense ce mois-ci'}
          isLoading={isLoading}
        />
        <KpiCard
          label="Moyenne journalière"
          value={formatCurrency(totals.dailyAverageExpense)}
          hint="Sur les jours écoulés du mois"
          isLoading={isLoading}
        />
        <KpiCard
          label="Économies potentielles"
          value={formatCurrency(opportunity)}
          hint="Dépassement cumulé des plafonds de catégorie"
          isLoading={isLoading}
        />
        <KpiCard
          label="Valeur du portefeuille"
          value={formatCurrency(portfolio.value)}
          hint={`${formatPercent(portfolio.gainRatio)} de rendement`}
          isLoading={isLoading}
        />
      </div>

      {/* Un graphique par question ; jamais deux échelles sur un même tracé. */}
      <div className="grid gap-4">
        <IncomeVsExpenseChart trend={trend} isRefreshing={isRefreshing} />

        <div className="grid gap-4 lg:grid-cols-2">
          <CategoryPieChart categories={categories} isRefreshing={isRefreshing} />
          <FixedVsVariableChart totals={totals} isRefreshing={isRefreshing} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SavingsTrendChart trend={trend} isRefreshing={isRefreshing} />
          <InvestmentTrendChart trend={trend} isRefreshing={isRefreshing} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ContributionChart
              contributions={contributions}
              labelFor={ownerLabel}
              isRefreshing={isRefreshing}
            />
          </div>
          <SavingsRateGauge totals={totals} />
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Comment lire ces chiffres"
          description="Conventions appliquées à l’ensemble de l’application."
        />
        <CardBody>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>
              <span className="font-medium text-ink">Dépenses et factures sont distinctes.</span>{' '}
              Une charge récurrente vit dans Factures, une transaction ponctuelle dans Dépenses.
              Les additionner donne les sorties totales ; les confondre les compterait deux fois.
            </li>
            <li>
              <span className="font-medium text-ink">La contribution suit le payeur réel.</span> Une
              dépense commune réglée par une seule personne lui est imputée ; les factures communes
              sont réparties à parts égales.
            </li>
            <li>
              <span className="font-medium text-ink">Le périmètre filtre l’affichage.</span> Les
              données privées de votre partenaire ne parviennent jamais à votre navigateur : elles
              sont écartées côté serveur, pas masquées côté interface.
            </li>
            <li>
              <span className="font-medium text-ink">Chaque graphique a un équivalent tabulaire.</span>{' '}
              Le bouton « Tableau » donne accès aux mêmes valeurs sans dépendre de la couleur.
            </li>
          </ul>
        </CardBody>
      </Card>
    </>
  );
}
