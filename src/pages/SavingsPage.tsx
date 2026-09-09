import { useMemo, useState } from 'react';
import { PiggyBank, Plus, Target } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { OwnerBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RowActions } from '@/components/ui/RowActions';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ContributionForm, SavingsGoalForm } from '@/components/forms/SavingsForms';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import { useHousehold } from '@/hooks/useHousehold';
import { useScope } from '@/hooks/useScope';
import { daysUntil, formatCurrency, formatDateShort, formatMonthLabel } from '@/lib/format';
import { round2 } from '@/lib/finance/calculations';
import type { SavingsContributionRow, SavingsGoalWithProgressRow } from '@/types/database';

export function SavingsPage() {
  const { scoped, current, totals, deltas, savingsOverview, isLoading, error, refetch } =
    useFinanceData();
  const { ownerLabel, canWrite } = useHousehold();
  const { year, month } = useScope();
  const { remove } = useFinanceMutations('savings_goals');
  const { remove: removeContribution } = useFinanceMutations('savings_contributions');

  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalWithProgressRow | undefined>();
  const [contributionGoal, setContributionGoal] = useState<SavingsGoalWithProgressRow | null>(null);

  const goals = scoped.goals;

  /** Versements du mois affiché, objectif résolu pour l'affichage. */
  const monthContributions = useMemo(
    () =>
      current.contributions.map((contribution) => ({
        contribution,
        goal: goals.find((candidate) => candidate.id === contribution.goal_id) ?? null,
      })),
    [current.contributions, goals],
  );

  const contributionColumns: Array<
    Column<{ contribution: SavingsContributionRow; goal: SavingsGoalWithProgressRow | null }>
  > = [
    {
      key: 'date',
      header: 'Date',
      render: ({ contribution }) => formatDateShort(contribution.date),
      sortValue: ({ contribution }) => contribution.date,
    },
    {
      key: 'goal',
      header: 'Objectif',
      render: ({ goal }) => goal?.name ?? 'Objectif supprimé',
      sortValue: ({ goal }) => goal?.name ?? '',
    },
    {
      key: 'owner',
      header: 'Propriétaire',
      render: ({ contribution }) => (
        <OwnerBadge owner={contribution.owner} label={ownerLabel(contribution.owner)} />
      ),
      sortValue: ({ contribution }) => ownerLabel(contribution.owner),
      hideOnMobile: true,
    },
    {
      key: 'amount',
      header: 'Montant',
      numeric: true,
      render: ({ contribution }) => {
        const amount = Number(contribution.amount);
        return (
          <span className={amount < 0 ? 'font-medium text-delta-down' : 'font-medium text-ink'}>
            {formatCurrency(amount)}
          </span>
        );
      },
      sortValue: ({ contribution }) => Number(contribution.amount),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: ({ contribution, goal }) => (
        <RowActions
          itemLabel={`le versement du ${formatDateShort(contribution.date)}`}
          // Un versement n'a pas de formulaire d'édition : le corriger revient
          // à en saisir un nouveau, éventuellement négatif. On ouvre donc la
          // saisie sur le même objectif plutôt qu'un formulaire de modification.
          onEdit={() => setContributionGoal(goal)}
          onDelete={() => removeContribution.mutate(contribution.id)}
          isDeleting={removeContribution.isPending}
        />
      ),
    },
  ];

  if (error) {
    return (
      <>
        <PageHeader title="Épargne" description="Objectifs et versements du foyer." />
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Épargne"
        description="Objectifs communs et personnels, alimentés par vos versements."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditingGoal(undefined);
                setIsGoalFormOpen(true);
              }}
              leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Nouvel objectif
            </Button>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Épargné ce mois-ci"
          value={formatCurrency(totals.totalSavings)}
          delta={deltas.savings}
          deltaDirection="up-is-good"
          icon={<PiggyBank className="h-4 w-4" aria-hidden />}
          isLoading={isLoading}
          emphasis
        />
        <KpiCard
          label="Total épargné"
          value={formatCurrency(savingsOverview.current)}
          hint={`Sur ${formatCurrency(savingsOverview.target)} visés`}
          isLoading={isLoading}
        />
        <KpiCard
          label="Reste à atteindre"
          value={formatCurrency(savingsOverview.remaining)}
          hint={`${Math.round(savingsOverview.progress * 100)} % du chemin parcouru`}
          isLoading={isLoading}
        />
        <KpiCard
          label="Taux d’épargne"
          value={
            totals.totalIncome > 0 ? `${Math.round(totals.savingsRate * 100)} %` : '—'
          }
          delta={deltas.savingsRate}
          deltaDirection="up-is-good"
          hint="Part des revenus mise de côté"
          isLoading={isLoading}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Objectifs"
          description="La progression se calcule à partir des versements enregistrés."
        />
        {isLoading ? (
          <LoadingState />
        ) : goals.length === 0 ? (
          <EmptyState
            title="Aucun objectif d’épargne"
            description="Créez un premier objectif pour suivre votre progression."
            icon={<Target className="h-5 w-5" aria-hidden />}
            action={
              canWrite ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingGoal(undefined);
                    setIsGoalFormOpen(true);
                  }}
                  leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
                >
                  Nouvel objectif
                </Button>
              ) : undefined
            }
          />
        ) : (
          <CardBody className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                ownerName={ownerLabel(goal.owner)}
                canWrite={canWrite}
                onAddContribution={() => setContributionGoal(goal)}
                onEdit={() => {
                  setEditingGoal(goal);
                  setIsGoalFormOpen(true);
                }}
                onDelete={() => remove.mutate(goal.id)}
                isDeleting={remove.isPending}
              />
            ))}
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Versements de ${formatMonthLabel(year, month)}`}
          description="Un montant négatif correspond à un retrait."
        />
        <DataTable
          rows={monthContributions}
          columns={contributionColumns}
          rowKey={({ contribution }) => contribution.id}
          isLoading={isLoading}
          defaultSortKey="date"
          emptyTitle="Aucun versement ce mois-ci"
          emptyDescription={`Rien n’a été enregistré pour ${formatMonthLabel(year, month)}.`}
          totalRow={{
            label: `Net ${formatMonthLabel(year, month)}`,
            value: formatCurrency(totals.totalSavings),
          }}
        />
      </Card>

      <SavingsGoalForm
        open={isGoalFormOpen}
        onClose={() => setIsGoalFormOpen(false)}
        goal={editingGoal}
      />
      <ContributionForm
        open={contributionGoal !== null}
        onClose={() => setContributionGoal(null)}
        goal={contributionGoal}
      />
    </>
  );
}

interface GoalCardProps {
  goal: SavingsGoalWithProgressRow;
  ownerName: string;
  canWrite: boolean;
  onAddContribution: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function GoalCard({
  goal,
  ownerName,
  canWrite,
  onAddContribution,
  onEdit,
  onDelete,
  isDeleting,
}: GoalCardProps) {
  const current = Number(goal.current_amount);
  const target = Number(goal.target_amount);
  const remaining = round2(Math.max(0, target - current));
  const ratio = target > 0 ? current / target : 0;

  const remainingDays = goal.target_date ? daysUntil(goal.target_date) : null;

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{goal.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
            <OwnerBadge owner={goal.owner} label={ownerName} />
            {goal.target_date ? (
              <span>
                Cible : {formatDateShort(goal.target_date)}
                {remainingDays !== null && remainingDays < 0 && remaining > 0
                  ? ' (dépassée)'
                  : ''}
              </span>
            ) : null}
          </div>
        </div>
        <RowActions
          itemLabel={goal.name}
          onEdit={onEdit}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
      </div>

      <ProgressBar
        value={ratio}
        valueLabel={`${formatCurrency(current)} / ${formatCurrency(target)}`}
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-sm text-ink-2">
          {remaining > 0 ? (
            <>
              Reste <span className="font-medium text-ink">{formatCurrency(remaining)}</span>
            </>
          ) : (
            <span className="font-medium text-good">Objectif atteint</span>
          )}
        </p>
        {canWrite ? (
          <Button variant="secondary" size="sm" onClick={onAddContribution}>
            Verser
          </Button>
        ) : null}
      </div>
    </div>
  );
}
