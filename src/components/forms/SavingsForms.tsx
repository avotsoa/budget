import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import {
  amountSchema,
  dateSchema,
  noteSchema,
  ownerSchema,
  signedAmountSchema,
  useOwnerOptions,
} from './fields';
import { todayISO } from '@/lib/format';
import { AMOUNT_STEP, CURRENCY } from '@/lib/constants';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import type { SavingsGoalWithProgressRow } from '@/types/database';

// --- Objectif ---------------------------------------------------------------

const goalSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(120, 'Nom trop long'),
  target_amount: amountSchema,
  target_date: z.string().optional(),
  owner: ownerSchema,
  note: noteSchema,
});

type GoalInput = z.input<typeof goalSchema>;
type GoalOutput = z.output<typeof goalSchema>;

interface SavingsGoalFormProps {
  open: boolean;
  onClose: () => void;
  goal?: SavingsGoalWithProgressRow | undefined;
}

export function SavingsGoalForm({ open, onClose, goal }: SavingsGoalFormProps) {
  const ownerOptions = useOwnerOptions();
  const { create, update } = useFinanceMutations('savings_goals');

  const isEditing = Boolean(goal);
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GoalInput, unknown, GoalOutput>({
    resolver: zodResolver(goalSchema),
    values: {
      name: goal?.name ?? '',
      target_amount: goal ? String(goal.target_amount) : '',
      target_date: goal?.target_date ?? '',
      owner: goal?.owner ?? 'shared',
      note: goal?.note ?? '',
    },
  });

  async function onSubmit(values: GoalOutput) {
    const payload = {
      ...values,
      target_date: values.target_date || null,
      note: values.note || null,
    };

    if (goal) {
      await update.mutateAsync({ id: goal.id, values: payload });
    } else {
      await create.mutateAsync(payload);
    }

    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Modifier l’objectif' : 'Nouvel objectif d’épargne'}
      description="Le montant atteint se calcule à partir des versements — il n’est pas saisi ici."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button form="goal-form" type="submit" isLoading={isPending}>
            {isEditing ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form
        id="goal-form"
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <TextField
          label="Nom de l’objectif"
          placeholder="Apport immobilier"
          containerClassName="sm:col-span-2"
          required
          error={errors.name?.message}
          {...register('name')}
        />

        <TextField
          label={`Montant cible (${CURRENCY.symbol})`}
          type="number"
          step={AMOUNT_STEP}
          min="0"
          inputMode="decimal"
          placeholder="45000000"
          required
          error={errors.target_amount?.message}
          {...register('target_amount')}
        />

        <TextField
          label="Date cible"
          type="date"
          hint="Facultative — sert au suivi de trajectoire."
          error={errors.target_date?.message}
          {...register('target_date')}
        />

        <SelectField
          label="Propriétaire"
          required
          containerClassName="sm:col-span-2"
          error={errors.owner?.message}
          {...register('owner')}
        >
          {ownerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <TextAreaField
          label="Note"
          containerClassName="sm:col-span-2"
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Dialog>
  );
}

// --- Versement --------------------------------------------------------------

const contributionSchema = z.object({
  date: dateSchema,
  amount: signedAmountSchema,
  note: noteSchema,
});

type ContributionInput = z.input<typeof contributionSchema>;
type ContributionOutput = z.output<typeof contributionSchema>;

interface ContributionFormProps {
  open: boolean;
  onClose: () => void;
  goal: SavingsGoalWithProgressRow | null;
}

export function ContributionForm({ open, onClose, goal }: ContributionFormProps) {
  const { create } = useFinanceMutations('savings_contributions');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContributionInput, unknown, ContributionOutput>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { date: todayISO(), amount: '', note: '' },
  });

  async function onSubmit(values: ContributionOutput) {
    if (!goal) return;

    await create.mutateAsync({
      ...values,
      note: values.note || null,
      goal_id: goal.id,
      // Le versement hérite du propriétaire de l'objectif : un versement
      // commun sur un objectif privé n'aurait pas de sens, et fausserait
      // le filtrage par périmètre.
      owner: goal.owner,
    });

    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ajouter un versement"
      description={goal ? `Objectif : ${goal.name}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Annuler
          </Button>
          <Button form="contribution-form" type="submit" isLoading={create.isPending}>
            Ajouter
          </Button>
        </>
      }
    >
      <form
        id="contribution-form"
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <TextField label="Date" type="date" required error={errors.date?.message} {...register('date')} />

        <TextField
          label={`Montant (${CURRENCY.symbol})`}
          type="number"
          step={AMOUNT_STEP}
          inputMode="decimal"
          placeholder="400000"
          hint="Un montant négatif enregistre un retrait."
          required
          error={errors.amount?.message}
          {...register('amount')}
        />

        <TextAreaField
          label="Note"
          containerClassName="sm:col-span-2"
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Dialog>
  );
}
