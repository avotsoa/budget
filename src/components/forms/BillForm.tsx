import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { amountSchema, dateSchema, noteSchema, ownerSchema, useOwnerOptions } from './fields';
import {
  AMOUNT_STEP,
  BILL_CATEGORIES,
  BILL_FREQUENCY_LABELS,
  BILL_STATUS_LABELS,
  CURRENCY,
} from '@/lib/constants';
import { todayISO } from '@/lib/format';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import type { BillFrequency, BillRow, BillStatus } from '@/types/database';

const schema = z.object({
  label: z.string().trim().min(1, 'Libellé requis').max(120, 'Libellé trop long'),
  amount: amountSchema,
  date: dateSchema,
  category: z.string().min(1, 'Catégorie requise'),
  frequency: z.enum(['monthly', 'bimonthly', 'quarterly', 'biannual', 'annual', 'once']),
  status: z.enum(['paid', 'pending', 'overdue']),
  owner: ownerSchema,
  note: noteSchema,
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface BillFormProps {
  open: boolean;
  onClose: () => void;
  bill?: BillRow | undefined;
}

export function BillForm({ open, onClose, bill }: BillFormProps) {
  const ownerOptions = useOwnerOptions();
  const { create, update } = useFinanceMutations('bills');

  const isEditing = Boolean(bill);
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    values: {
      label: bill?.label ?? '',
      amount: bill ? String(bill.amount) : '',
      date: bill?.date ?? todayISO(),
      category: bill?.category ?? BILL_CATEGORIES[0],
      frequency: bill?.frequency ?? 'monthly',
      status: bill?.status ?? 'pending',
      owner: bill?.owner ?? 'shared',
      note: bill?.note ?? '',
    },
  });

  async function onSubmit(values: FormOutput) {
    const payload = { ...values, note: values.note || null };

    if (bill) {
      await update.mutateAsync({ id: bill.id, values: payload });
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
      title={isEditing ? 'Modifier la facture' : 'Ajouter une facture'}
      description="Charge récurrente : loyer, énergie, assurance, abonnement…"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button form="bill-form" type="submit" isLoading={isPending}>
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      }
    >
      <form
        id="bill-form"
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <TextField
          label="Libellé"
          placeholder="Loyer"
          containerClassName="sm:col-span-2"
          required
          error={errors.label?.message}
          {...register('label')}
        />

        <TextField
          label={`Montant (${CURRENCY.symbol})`}
          type="number"
          step={AMOUNT_STEP}
          min="0"
          inputMode="decimal"
          placeholder="650000"
          required
          error={errors.amount?.message}
          {...register('amount')}
        />

        <TextField
          label="Date d’échéance"
          type="date"
          required
          error={errors.date?.message}
          {...register('date')}
        />

        <SelectField label="Catégorie" required error={errors.category?.message} {...register('category')}>
          {BILL_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Fréquence"
          required
          error={errors.frequency?.message}
          {...register('frequency')}
        >
          {(Object.keys(BILL_FREQUENCY_LABELS) as BillFrequency[]).map((frequency) => (
            <option key={frequency} value={frequency}>
              {BILL_FREQUENCY_LABELS[frequency]}
            </option>
          ))}
        </SelectField>

        <SelectField label="Statut" required error={errors.status?.message} {...register('status')}>
          {(Object.keys(BILL_STATUS_LABELS) as BillStatus[]).map((status) => (
            <option key={status} value={status}>
              {BILL_STATUS_LABELS[status]}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Propriétaire"
          required
          hint="« Commun » rend la facture visible par votre partenaire."
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
          placeholder="Référence client, précision…"
          containerClassName="sm:col-span-2"
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Dialog>
  );
}
