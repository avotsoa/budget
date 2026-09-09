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
  partnerSchema,
  useOwnerOptions,
  usePayerOptions,
} from './fields';
import { AMOUNT_STEP, CURRENCY, EXPENSE_CATEGORIES, EXPENSE_KIND_LABELS } from '@/lib/constants';
import { todayISO } from '@/lib/format';
import { useFinanceMutations } from '@/hooks/useFinanceMutations';
import { useHousehold } from '@/hooks/useHousehold';
import type { ExpenseKind, ExpenseRow } from '@/types/database';

const schema = z.object({
  date: dateSchema,
  amount: amountSchema,
  category: z.string().min(1, 'Catégorie requise'),
  subcategory: z.string().trim().max(80, 'Sous-catégorie trop longue').optional(),
  kind: z.enum(['fixed', 'variable']),
  paid_by: partnerSchema,
  owner: ownerSchema,
  label: z.string().trim().max(120, 'Libellé trop long'),
  note: noteSchema,
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  expense?: ExpenseRow | undefined;
}

export function ExpenseForm({ open, onClose, expense }: ExpenseFormProps) {
  const { mySlot } = useHousehold();
  const ownerOptions = useOwnerOptions();
  const payerOptions = usePayerOptions();
  const { create, update } = useFinanceMutations('expenses');

  const isEditing = Boolean(expense);
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    values: {
      date: expense?.date ?? todayISO(),
      amount: expense ? String(expense.amount) : '',
      category: expense?.category ?? EXPENSE_CATEGORIES[0],
      subcategory: expense?.subcategory ?? '',
      kind: expense?.kind ?? 'variable',
      paid_by: expense?.paid_by ?? mySlot ?? 'partnerA',
      owner: expense?.owner ?? 'shared',
      label: expense?.label ?? '',
      note: expense?.note ?? '',
    },
  });

  async function onSubmit(values: FormOutput) {
    const payload = {
      ...values,
      subcategory: values.subcategory || null,
      note: values.note || null,
    };

    if (expense) {
      await update.mutateAsync({ id: expense.id, values: payload });
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
      title={isEditing ? 'Modifier la dépense' : 'Ajouter une dépense'}
      description="Une transaction ponctuelle. Les charges récurrentes se saisissent dans Factures."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button form="expense-form" type="submit" isLoading={isPending}>
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      }
    >
      <form
        id="expense-form"
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
          placeholder="95000"
          required
          error={errors.amount?.message}
          {...register('amount')}
        />

        <SelectField label="Catégorie" required error={errors.category?.message} {...register('category')}>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Sous-catégorie"
          placeholder="Courses, Carburant…"
          error={errors.subcategory?.message}
          {...register('subcategory')}
        />

        <SelectField label="Type" required error={errors.kind?.message} {...register('kind')}>
          {(Object.keys(EXPENSE_KIND_LABELS) as ExpenseKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {EXPENSE_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Payé par"
          required
          hint="Qui a réellement décaissé — indépendant du propriétaire."
          error={errors.paid_by?.message}
          {...register('paid_by')}
        >
          {payerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Propriétaire"
          required
          hint="« Commun » rend la ligne visible par votre partenaire."
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
          placeholder="Courses hebdomadaires"
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
