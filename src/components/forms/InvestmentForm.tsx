import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { amountSchema, dateSchema, noteSchema, ownerSchema, useOwnerOptions } from './fields';
import { AMOUNT_STEP, CURRENCY, INVESTMENT_TYPE_LABELS } from '@/lib/constants';
import { todayISO } from '@/lib/format';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import type { InvestmentRow, InvestmentType } from '@/types/database';

const schema = z.object({
  label: z.string().trim().min(1, 'Libellé requis').max(120, 'Libellé trop long'),
  investment_type: z.enum([
    'real_estate',
    'stocks',
    'crypto',
    'life_insurance',
    'long_term_savings',
    'other',
  ]),
  date: dateSchema,
  invested_amount: amountSchema,
  // La valeur courante peut être nulle (perte totale) : elle ne passe donc pas
  // par `amountSchema`, qui exige un montant strictement positif.
  current_value: z
    .string()
    .min(1, 'Valeur requise')
    .refine((value) => !Number.isNaN(Number(value)), 'Valeur invalide')
    .refine((value) => Number(value) >= 0, 'La valeur ne peut pas être négative')
    .transform((value) => Number(value)),
  owner: ownerSchema,
  note: noteSchema,
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface InvestmentFormProps {
  open: boolean;
  onClose: () => void;
  investment?: InvestmentRow | undefined;
}

export function InvestmentForm({ open, onClose, investment }: InvestmentFormProps) {
  const ownerOptions = useOwnerOptions();
  const { create, update } = useFinanceMutations('investments');

  const isEditing = Boolean(investment);
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    values: {
      label: investment?.label ?? '',
      investment_type: investment?.investment_type ?? 'stocks',
      date: investment?.date ?? todayISO(),
      invested_amount: investment ? String(investment.invested_amount) : '',
      current_value: investment ? String(investment.current_value) : '',
      owner: investment?.owner ?? 'shared',
      note: investment?.note ?? '',
    },
  });

  async function onSubmit(values: FormOutput) {
    const payload = { ...values, note: values.note || null };

    if (investment) {
      await update.mutateAsync({ id: investment.id, values: payload });
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
      title={isEditing ? 'Modifier l’investissement' : 'Ajouter un investissement'}
      description="Un versement ou une ligne de portefeuille, avec sa valeur actuelle."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button form="investment-form" type="submit" isLoading={isPending}>
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      }
    >
      <form
        id="investment-form"
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <TextField
          label="Libellé"
          placeholder="ETF MSCI World (PEA)"
          containerClassName="sm:col-span-2"
          required
          error={errors.label?.message}
          {...register('label')}
        />

        <SelectField
          label="Type"
          required
          error={errors.investment_type?.message}
          {...register('investment_type')}
        >
          {(Object.keys(INVESTMENT_TYPE_LABELS) as InvestmentType[]).map((type) => (
            <option key={type} value={type}>
              {INVESTMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>

        <TextField label="Date" type="date" required error={errors.date?.message} {...register('date')} />

        <TextField
          label={`Montant investi (${CURRENCY.symbol})`}
          type="number"
          step={AMOUNT_STEP}
          min="0"
          inputMode="decimal"
          placeholder="350000"
          required
          error={errors.invested_amount?.message}
          {...register('invested_amount')}
        />

        <TextField
          label={`Valeur actuelle (${CURRENCY.symbol})`}
          type="number"
          step={AMOUNT_STEP}
          min="0"
          inputMode="decimal"
          placeholder="372000"
          hint="Sert au calcul de la plus-value."
          required
          error={errors.current_value?.message}
          {...register('current_value')}
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
