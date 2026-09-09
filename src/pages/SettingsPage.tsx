import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check, Copy, Database, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Badge, OwnerBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { supabase, toErrorMessage } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { useTheme } from '@/hooks/useTheme';
import { useFinanceData, financeQueryKey } from '@/hooks/useFinanceData';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import { householdQueryKey } from '@/contexts/HouseholdContext';
import {
  AMOUNT_STEP,
  CURRENCY,
  EXPENSE_CATEGORIES,
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
} from '@/lib/constants';
import { formatCurrency, formatDateShort } from '@/lib/format';
import type { CategoryBudgetRow, MemberRole } from '@/types/database';

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Profil, foyer, rôles, budgets et données de démonstration."
      />

      <div className="grid gap-4">
        <ProfileCard />
        <HouseholdCard />
        <MembersCard />
        <BudgetsCard />
        <AppearanceCard />
        <DemoDataCard />
      </div>
    </>
  );
}

// --- Profil -----------------------------------------------------------------

const profileSchema = z.object({
  display_name: z.string().trim().min(2, 'Au moins 2 caractères').max(60, 'Nom trop long'),
});

function ProfileCard() {
  const { user } = useAuth();
  const { mySlot, ownerLabel, refresh } = useHousehold();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { display_name: mySlot ? ownerLabel(mySlot) : '' },
  });

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: values.display_name })
      .eq('id', user?.id ?? '');

    if (error) {
      toast.error(toErrorMessage(error));
      return;
    }

    toast.success('Profil mis à jour');
    await refresh();
    await queryClient.invalidateQueries({ queryKey: householdQueryKey });
  }

  return (
    <Card>
      <CardHeader
        title="Mon profil"
        description="Le nom affiché à votre partenaire sur les données partagées."
      />
      <CardBody>
        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          className="flex flex-wrap items-end gap-3"
          noValidate
        >
          <TextField
            label="Nom affiché"
            containerClassName="min-w-[14rem] flex-1"
            required
            error={errors.display_name?.message}
            {...register('display_name')}
          />
          <Button type="submit" isLoading={isSubmitting}>
            Enregistrer
          </Button>
        </form>
        <p className="mt-3 text-sm text-ink-muted">
          Compte : <span className="text-ink-2">{user?.email}</span>
        </p>
      </CardBody>
    </Card>
  );
}

// --- Foyer ------------------------------------------------------------------

function HouseholdCard() {
  const { household, partnerSlot, myRole, regenerateInviteCode } = useHousehold();
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function copyCode() {
    if (!household) return;
    try {
      await navigator.clipboard.writeText(household.invite_code);
      setIsCopied(true);
      toast.success('Code copié');
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // L'API presse-papiers exige un contexte sécurisé : sur http://
      // non-localhost elle échoue, le code reste sélectionnable à la main.
      toast.error('Copie impossible — sélectionnez le code manuellement.');
    }
  }

  async function regenerate() {
    setIsRegenerating(true);
    try {
      await regenerateInviteCode();
      toast.success('Nouveau code généré');
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Foyer"
        description={
          partnerSlot
            ? 'Les deux partenaires ont rejoint le foyer.'
            : 'Transmettez ce code à votre partenaire pour qu’il vous rejoigne.'
        }
      />
      <CardBody className="space-y-4">
        <div>
          <p className="text-sm text-ink-2">Nom du foyer</p>
          <p className="font-medium text-ink">{household?.name}</p>
        </div>

        <div>
          <p className="mb-1.5 text-sm text-ink-2">Code d’invitation</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-lg font-semibold tracking-[0.3em] text-ink">
              {household?.invite_code}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyCode()}
              leadingIcon={
                isCopied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )
              }
            >
              {isCopied ? 'Copié' : 'Copier'}
            </Button>
            {myRole === 'owner' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void regenerate()}
                isLoading={isRegenerating}
                leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              >
                Régénérer
              </Button>
            ) : null}
          </div>
          {partnerSlot ? (
            <p className="mt-2 text-sm text-ink-muted">
              Le foyer est complet : ce code ne peut plus être utilisé.
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

// --- Membres et rôles -------------------------------------------------------

function MembersCard() {
  const { members, myRole, refresh } = useHousehold();
  const { user } = useAuth();

  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: MemberRole }) => {
      const { error } = await supabase
        .from('household_members')
        .update({ role })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Rôle mis à jour');
      await refresh();
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  });

  const isOwner = myRole === 'owner';

  return (
    <Card>
      <CardHeader
        title="Membres et rôles"
        description="Le propriétaire du foyer peut ajuster les droits de son partenaire."
      />
      <CardBody className="space-y-3">
        {members.map((member) => {
          const isMe = member.user_id === user?.id;

          return (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <OwnerBadge owner={member.partner_slot} label={member.profile.display_name} />
                  {isMe ? <Badge tone="brand">Vous</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  A rejoint le {formatDateShort(member.joined_at)}
                </p>
              </div>

              {isOwner && !isMe ? (
                <select
                  value={member.role}
                  onChange={(event) =>
                    updateRole.mutate({
                      memberId: member.id,
                      role: event.target.value as MemberRole,
                    })
                  }
                  className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
                >
                  {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => (
                    <option key={role} value={role}>
                      {MEMBER_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge>{MEMBER_ROLE_LABELS[member.role]}</Badge>
              )}
            </div>
          );
        })}

        <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
          {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => (
            <div key={role} className="flex gap-2">
              <dt className="shrink-0 font-medium text-ink">{MEMBER_ROLE_LABELS[role]} :</dt>
              <dd className="text-ink-2">{MEMBER_ROLE_DESCRIPTIONS[role]}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

// --- Budgets par catégorie --------------------------------------------------

const budgetSchema = z.object({
  category: z.string().min(1, 'Catégorie requise'),
  monthly_limit: z
    .string()
    .min(1, 'Plafond requis')
    .refine((value) => Number(value) > 0, 'Le plafond doit être supérieur à 0')
    .transform((value) => Number(value)),
});

function BudgetsCard() {
  const { scoped, isLoading } = useFinanceData();
  const { canWrite } = useHousehold();
  const { create, remove } = useFinanceMutations('category_budgets');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof budgetSchema>, unknown, z.output<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category: EXPENSE_CATEGORIES[0], monthly_limit: '' },
  });

  async function onSubmit(values: z.output<typeof budgetSchema>) {
    await create.mutateAsync({ ...values, owner: 'shared' });
    reset();
  }

  const columns: Array<Column<CategoryBudgetRow>> = [
    {
      key: 'category',
      header: 'Catégorie',
      render: (row) => row.category,
      sortValue: (row) => row.category,
    },
    {
      key: 'limit',
      header: 'Plafond mensuel',
      numeric: true,
      render: (row) => formatCurrency(Number(row.monthly_limit)),
      sortValue: (row) => Number(row.monthly_limit),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16',
      render: (row) =>
        canWrite ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove.mutate(row.id)}
              aria-label={`Supprimer le budget ${row.category}`}
              className="hover:text-critical"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Budgets par catégorie"
        description="Un plafond mensuel déclenche une alerte dès 85 % de consommation."
      />

      {canWrite ? (
        <CardBody className="border-b border-line">
          <form
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
            className="flex flex-wrap items-end gap-3"
            noValidate
          >
            <SelectField
              label="Catégorie"
              containerClassName="min-w-[10rem]"
              error={errors.category?.message}
              {...register('category')}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </SelectField>

            <TextField
              label={`Plafond mensuel (${CURRENCY.symbol})`}
              type="number"
              step={AMOUNT_STEP}
              min="0"
              inputMode="decimal"
              placeholder="550000"
              containerClassName="min-w-[10rem]"
              error={errors.monthly_limit?.message}
              {...register('monthly_limit')}
            />

            <Button type="submit" isLoading={create.isPending}>
              Définir
            </Button>
          </form>
        </CardBody>
      ) : null}

      <DataTable
        rows={scoped.budgets}
        columns={columns}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        defaultSortKey="limit"
        emptyTitle="Aucun budget défini"
        emptyDescription="Définissez un plafond pour être averti avant de le dépasser."
      />
    </Card>
  );
}

// --- Apparence --------------------------------------------------------------

function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader title="Apparence" description="Le thème est mémorisé sur cet appareil." />
      <CardBody>
        <div role="radiogroup" aria-label="Thème" className="flex gap-2">
          {(
            [
              { value: 'light', label: 'Clair', icon: <Sun className="h-4 w-4" aria-hidden /> },
              { value: 'dark', label: 'Sombre', icon: <Moon className="h-4 w-4" aria-hidden /> },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              onClick={() => setTheme(option.value)}
              className={
                theme === option.value
                  ? 'inline-flex items-center gap-2 rounded-lg border border-brand bg-brand/10 px-4 py-2 text-sm font-medium text-brand'
                  : 'inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2'
              }
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// --- Données de démonstration ----------------------------------------------

function DemoDataCard() {
  const queryClient = useQueryClient();
  const { canWrite } = useHousehold();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const seed = useMutation({
    mutationFn: async (reset: boolean) => {
      const { data, error } = await supabase.rpc('seed_demo_data', { p_reset: reset });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async (message) => {
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: financeQueryKey });
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  });

  if (!canWrite) return null;

  return (
    <Card>
      <CardHeader
        title="Données de démonstration"
        description="Huit mois d’historique réaliste, réparti entre les deux partenaires."
      />
      <CardBody className="space-y-3">
        <p className="text-sm text-ink-2">
          Les lignes attribuées à votre partenaire sont créées même s’il n’a pas encore rejoint le
          foyer : ses données privées vous resteront invisibles, ce qui permet de vérifier la
          séparation privé / partagé sur des données réelles.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => seed.mutate(false)}
            isLoading={seed.isPending}
            leadingIcon={<Database className="h-4 w-4" aria-hidden />}
          >
            Charger les données de démonstration
          </Button>
          <Button variant="ghost" onClick={() => setIsConfirmOpen(true)} disabled={seed.isPending}>
            Réinitialiser et recharger
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          seed.mutate(true);
          setIsConfirmOpen(false);
        }}
        title="Réinitialiser le foyer"
        message="Toutes les données financières du foyer seront définitivement supprimées, y compris celles de votre partenaire, puis remplacées par un jeu de démonstration. Cette action est irréversible."
        confirmLabel="Tout remplacer"
        isPending={seed.isPending}
      />
    </Card>
  );
}
