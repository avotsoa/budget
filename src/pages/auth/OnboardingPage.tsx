import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Home, LogOut, UserPlus } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { toErrorMessage } from '@/lib/supabase';

const createSchema = z.object({
  name: z.string().trim().min(2, 'Au moins 2 caractères'),
});

const joinSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .length(6, 'Le code comporte 6 caractères')
    // L'alphabet du code exclut I, O, 0 et 1 (voir generate_invite_code).
    .regex(/^[A-HJ-NP-Za-hj-np-z2-9]+$/, 'Code invalide'),
});

type Mode = 'create' | 'join';

/**
 * Écran affiché à un utilisateur authentifié qui n'appartient encore à aucun
 * foyer : il en crée un, ou rejoint celui de son partenaire avec le code.
 */
export function OnboardingPage() {
  const [mode, setMode] = useState<Mode>('create');
  const { signOut } = useAuth();

  return (
    <AuthLayout
      title="Votre foyer"
      subtitle="Créez votre espace commun ou rejoignez celui de votre partenaire"
      footer={
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center gap-1.5 hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Changer de compte
        </button>
      }
    >
      <div
        role="tablist"
        aria-label="Mode de rattachement"
        className="mb-5 flex gap-1 rounded-lg bg-surface-2 p-1"
      >
        <ModeTab
          isActive={mode === 'create'}
          onClick={() => setMode('create')}
          icon={<Home className="h-4 w-4" aria-hidden />}
          label="Créer un foyer"
        />
        <ModeTab
          isActive={mode === 'join'}
          onClick={() => setMode('join')}
          icon={<UserPlus className="h-4 w-4" aria-hidden />}
          label="Rejoindre"
        />
      </div>

      {mode === 'create' ? <CreateHouseholdForm /> : <JoinHouseholdForm />}
    </AuthLayout>
  );
}

function ModeTab({
  isActive,
  onClick,
  icon,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function CreateHouseholdForm() {
  const { createHousehold } = useHousehold();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: 'Notre foyer' },
  });

  async function onSubmit(values: z.infer<typeof createSchema>) {
    setFormError(null);
    try {
      await createHousehold(values.name);
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="space-y-4" noValidate>
      <TextField
        label="Nom du foyer"
        placeholder="Notre foyer"
        hint="Vous recevrez ensuite un code à transmettre à votre partenaire."
        required
        error={errors.name?.message}
        {...register('name')}
      />

      {formError ? (
        <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Créer le foyer
      </Button>
    </form>
  );
}

function JoinHouseholdForm() {
  const { joinHousehold } = useHousehold();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: { inviteCode: '' },
  });

  async function onSubmit(values: z.infer<typeof joinSchema>) {
    setFormError(null);
    try {
      await joinHousehold(values.inviteCode);
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="space-y-4" noValidate>
      <TextField
        label="Code d’invitation"
        placeholder="A2B4C6"
        autoCapitalize="characters"
        maxLength={6}
        className="text-center text-lg font-semibold tracking-[0.3em] uppercase"
        hint="Les 6 caractères communiqués par votre partenaire."
        required
        error={errors.inviteCode?.message}
        {...register('inviteCode')}
      />

      {formError ? (
        <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Rejoindre le foyer
      </Button>
    </form>
  );
}
