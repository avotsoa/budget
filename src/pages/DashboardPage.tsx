import {
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  PiggyBank,
  Receipt,
  Scale,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { OwnerBadge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/States';
import {
  CategoryPieChart,
  IncomeVsExpenseChart,
  SavingsRateGauge,
} from '@/components/charts/FinanceCharts';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useHouseholdTotals } from '@/hooks/useHouseholdTotals';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import { capitalize, formatCurrency, formatMonthLabel, formatPercent } from '@/lib/format';
import { SCOPE_LABELS } from '@/lib/constants';
import { computeContributions } from '@/lib/finance/calculations';

export function DashboardPage() {
  const {
    current,
    totals,
    deltas,
    trend,
    categories,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useFinanceData();
  const { ownerLabel, partnerSlot } = useHousehold();
  const { year, month, scope } = useScope();

  const contributions = computeContributions(current);

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Vue d’ensemble du mois." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${capitalize(formatMonthLabel(year, month))} · ${SCOPE_LABELS[scope]}`}
      />

      {!partnerSlot ? <PartnerInviteNotice /> : null}

      {/* Le total du foyer n'a de sens qu'à deux : seul, il répéterait
          exactement les indicateurs ci-dessous. */}
      {partnerSlot ? <HouseholdTotalsCard /> : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenus"
          value={formatCurrency(totals.totalIncome)}
          delta={deltas.income}
          deltaDirection="up-is-good"
          icon={<ArrowUpCircle className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Dépenses"
          value={formatCurrency(totals.totalExpenses)}
          delta={deltas.expenses}
          deltaDirection="down-is-good"
          icon={<ArrowDownCircle className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Factures"
          value={formatCurrency(totals.totalBills)}
          delta={deltas.bills}
          deltaDirection="down-is-good"
          hint={
            totals.unpaidBills > 0 ? `${formatCurrency(totals.unpaidBills)} à régler` : 'Tout est réglé'
          }
          icon={<Receipt className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Solde de fin de mois"
          value={formatCurrency(totals.monthlyBalance)}
          delta={deltas.balance}
          deltaDirection="up-is-good"
          icon={<Scale className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
          emphasis
        />

        <KpiCard
          label="Épargne du mois"
          value={formatCurrency(totals.totalSavings)}
          delta={deltas.savings}
          deltaDirection="up-is-good"
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Investissements"
          value={formatCurrency(totals.totalInvested)}
          delta={deltas.investments}
          deltaDirection="up-is-good"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Reste à vivre"
          value={formatCurrency(totals.remainingToLive)}
          delta={deltas.remaining}
          deltaDirection="up-is-good"
          hint="Après charges, épargne et investissements"
          icon={<Wallet className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Taux d’épargne"
          value={formatPercent(totals.savingsRate)}
          delta={deltas.savingsRate}
          deltaDirection="up-is-good"
          icon={<Landmark className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncomeVsExpenseChart trend={trend} isRefreshing={isFetching && !isLoading} />
        </div>
        <SavingsRateGauge totals={totals} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryPieChart categories={categories} isRefreshing={isFetching && !isLoading} />

        <Card>
          <CardHeader
            title="Vue par partenaire"
            description="Ce que chacun a perçu et réellement décaissé ce mois-ci."
          />
          <CardBody className="space-y-4">
            {contributions.map((entry) => (
              <div key={entry.slot} className="rounded-lg border border-line p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <OwnerBadge owner={entry.slot} label={ownerLabel(entry.slot)} />
                  <span className="text-xs text-ink-muted">
                    {formatPercent(entry.paidShare)} des dépenses
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-2">Revenus</dt>
                    <dd className="font-medium tabular-nums text-ink">
                      {formatCurrency(entry.income)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-2">A payé</dt>
                    <dd className="font-medium tabular-nums text-ink">
                      {formatCurrency(entry.paidAmount)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}

            <p className="text-xs text-ink-muted">
              Les données privées de votre partenaire ne vous sont jamais transmises : ces totaux
              ne portent que sur ce que vous êtes autorisé à voir.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/**
 * Totaux du foyer entier, parts privées des deux partenaires comprises.
 *
 * Les indicateurs de cette page ne montrent que le périmètre de l'utilisateur :
 * à deux, ils affichent donc deux résultats différents pour un même foyer.
 * Cette carte donne le seul chiffre sur lequel les deux s'accordent.
 */
function HouseholdTotalsCard() {
  const { totals, isLoading, error } = useHouseholdTotals();

  // Échec silencieux : le reste du tableau de bord reste utilisable, et une
  // carte d'erreur en tête de page pour un complément d'information serait
  // disproportionnée.
  if (error) return null;

  const figures = [
    { label: 'Revenus', value: totals?.total_income },
    { label: 'Dépenses et factures', value: totals?.total_outflow },
    { label: 'Épargne', value: totals?.total_savings },
    { label: 'Reste à vivre', value: totals?.remaining_to_live, emphasis: true },
  ];

  return (
    <Card className="mb-5">
      <CardHeader
        title="Foyer complet"
        description="Vos deux parts privées additionnées. Totaux seuls, sans détail."
      />
      <CardBody>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {figures.map((figure) => (
            <div key={figure.label}>
              <dt className="text-xs text-ink-2">{figure.label}</dt>
              <dd
                className={`mt-1 tabular-nums ${
                  figure.emphasis ? 'text-lg font-semibold text-ink' : 'font-medium text-ink'
                }`}
              >
                {isLoading || figure.value === undefined ? (
                  <span className="text-ink-muted">—</span>
                ) : (
                  formatCurrency(figure.value)
                )}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 flex items-start gap-2 text-xs text-ink-muted">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Ces montants incluent les données privées de votre partenaire. Leur composition — libellés,
            dates, catégories — reste invisible. À deux en revanche, soustraire votre propre part
            révèle la sienne : c’est une conséquence de l’arithmétique, pas un défaut.
          </span>
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Rappel affiché tant que le second partenaire n'a pas rejoint le foyer :
 * sans lui, la moitié des promesses de l'application reste invisible.
 */
function PartnerInviteNotice() {
  const { household } = useHousehold();

  return (
    <Card className="mb-5 border-brand/40">
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">Votre partenaire n’a pas encore rejoint le foyer</p>
          <p className="mt-0.5 text-sm text-ink-2">
            Transmettez-lui le code{' '}
            <span className="font-semibold tracking-[0.2em] text-brand">
              {household?.invite_code}
            </span>{' '}
            pour partager le budget commun.
          </p>
        </div>
        <Link
          to="/parametres"
          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          Voir les paramètres
        </Link>
      </CardBody>
    </Card>
  );
}
