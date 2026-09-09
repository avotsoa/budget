import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { useAuth } from '@/hooks/useAuth';
import { toErrorMessage } from '@/lib/supabase';

const schema = z
  .object({
    displayName: z.string().trim().min(2, 'Au moins 2 caractères'),
    email: z.email('Adresse e-mail invalide'),
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  /** Adresse à confirmer, renseignée seulement si le projet l'exige. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const { needsEmailConfirmation } = await signUp(
        values.email,
        values.password,
        values.displayName,
      );

      if (needsEmailConfirmation) {
        // Aucune session n'existe encore : rediriger enverrait l'utilisateur
        // sur un écran de connexion sans explication.
        setPendingEmail(values.email);
        return;
      }

      // La suite du parcours (créer ou rejoindre un foyer) est décidée par le
      // routeur selon l'appartenance à un foyer.
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }

  if (pendingEmail) {
    return (
      <AuthLayout
        title="Confirmez votre adresse"
        subtitle="Un lien vous attend dans votre boîte mail"
        footer={
          <Link to="/connexion" className="font-medium text-brand hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <div className="space-y-4 text-sm text-ink-2">
          <div className="flex items-start gap-3 rounded-lg bg-brand/10 p-3">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <p>
              Nous avons envoyé un lien de confirmation à{' '}
              <span className="font-medium text-ink">{pendingEmail}</span>. Cliquez dessus pour
              activer votre compte — vous serez ramené ici, déjà connecté.
            </p>
          </div>
          <p>
            Le message peut mettre une minute à arriver, et atterrit parfois dans les indésirables.
          </p>
          <button
            type="button"
            onClick={() => setPendingEmail(null)}
            className="font-medium text-brand hover:underline"
          >
            Utiliser une autre adresse
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Premier pas vers un budget partagé"
      footer={
        <>
          Vous avez déjà un compte ?{' '}
          <Link to="/connexion" className="font-medium text-brand hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="space-y-4" noValidate>
        <TextField
          label="Prénom"
          autoComplete="given-name"
          placeholder="Camille"
          hint="Affiché à votre partenaire sur les données partagées."
          required
          error={errors.displayName?.message}
          {...register('displayName')}
        />

        <TextField
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />

        <TextField
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {formError ? (
          <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
