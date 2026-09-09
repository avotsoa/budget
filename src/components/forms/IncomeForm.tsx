import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { amountSchema, dateSchema, noteSchema, ownerSchema, useOwnerOptions } from './fields';
import { AMOUNT_STEP, CURRENCY, INCOME_TYPE_LABELS } from '@/lib/constants';
import { todayISO } from '@/lib/format';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import type { IncomeRow, IncomeType } from '@/types/database';

const schema = z.object({
  date: dateSchema,
  amount: amountSchema,
  income_type: z.enum(['salary', 'bonus', 'freelance', 'benefits', 'rental', 'other']),
  owner: ownerSchema,
  label: z.string().trim().max(120, 'Libellé trop long'),
  note: noteSchema,
});

/** Valeurs avant transformation zod — ce que manipule react-hook-form. */
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface IncomeFormProps {
  open: boolean;
  onClose: () => void;
  /** Présent en modification, absent en création. */
  income?: IncomeRow | undefined;
}

export function IncomeForm({ open, onClose, income }: IncomeFormProps) {
  const ownerOptions = useOwnerOptions();
  const { create, update } = useFinanceMutations('incomes');

  const isEditing = Boolean(income);
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    values: {
      date: income?.date ?? todayISO(),
      amount: income ? String(income.amount) : '',
      income_type: income?.income_type ?? 'salary',
      // Commun par défaut, comme les quatre autres formulaires. Un revenu
      // pré-rempli en privé était validé sans qu'on le remarque, et restait
      // alors invisible pour le partenaire.
      owner: income?.owner ?? 'shared',
      label: income?.label ?? '',
      note: income?.note ?? '',
    },
  });

  async function onSubmit(values: FormOutput) {
    const payload = { ...values, note: values.note || null };

    if (income) {
      await update.mutateAsync({ id: income.id, values: payload });
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
      title={isEditing ? 'Modifier le revenu' : 'Ajouter un revenu'}
      description="Salaire, prime, mission freelance ou toute autre entrée d’argent."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button form="income-form" type="submit" isLoading={isPending}>
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      }
    >
      <form
        id="income-form"
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <TextField label="Date" type="date" required error={errors.date?.message} {...register('date')} />

        <TextField
          label={`Montant (${CURRENCY.symbol})`}
          type="number"
          step={AMOUNT_STEP}
          min="0"
          inputMode="decimal"
          placeholder="1450000"
          required
          error={errors.amount?.message}
          {...register('amount')}
        />

        <SelectField
          label="Type de revenu"
          required
          error={errors.income_type?.message}
          {...register('income_type')}
        >
          {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((type) => (
            <option key={type} value={type}>
              {INCOME_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Propriétaire"
          required
          hint="« Commun » rend la ligne visible et modifiable par votre partenaire."
          error={errors.owner?.message}
          {...register('owner')}
        >
          {ownerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Libellé"
          placeholder="Salaire net"
          containerClassName="sm:col-span-2"
          error={errors.label?.message}
          {...register('label')}
        />

        <TextAreaField
          label="Note"
          placeholder="Précision facultative"
          containerClassName="sm:col-span-2"
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Dialog>
  );
}
