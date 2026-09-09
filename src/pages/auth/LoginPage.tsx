import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { useAuth } from '@/hooks/useAuth';
import { toErrorMessage } from '@/lib/supabase';

const schema = z.object({
  email: z.email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accédez au budget de votre foyer"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="font-medium text-brand hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="space-y-4" noValidate>
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
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />

        {formError ? (
          <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  );
}
