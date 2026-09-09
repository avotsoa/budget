import { KeyRound, Terminal } from 'lucide-react';

/**
 * Écran d'installation affiché tant que les variables Supabase manquent.
 *
 * Plutôt que de laisser l'application planter au premier appel réseau, on
 * explique précisément ce qu'il reste à faire.
 */
export function SetupPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-plane p-4">
      <div className="w-full max-w-2xl rounded-xl border border-line bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-ink">
            <KeyRound className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">Configuration requise</h1>
            <p className="text-sm text-ink-2">
              L’application a besoin d’un projet Supabase pour démarrer.
            </p>
          </div>
        </div>

        <ol className="space-y-4 text-sm text-ink-2">
          <Step index={1} title="Créer un projet Supabase">
            Rendez-vous sur{' '}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand hover:underline"
            >
              supabase.com/dashboard
            </a>{' '}
            et créez un projet (l’offre gratuite suffit).
          </Step>

          <Step index={2} title="Renseigner les variables d’environnement">
            Copiez <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">.env.example</code>{' '}
            vers <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">.env</code>, puis
            collez-y l’URL du projet et la clé <em>anon</em> trouvées dans{' '}
            <em>Project Settings → API</em>.
            <pre className="scrollbar-slim mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs text-ink">
              {`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
            </pre>
          </Step>

          <Step index={3} title="Exécuter les migrations">
            Dans le <em>SQL Editor</em> de Supabase, exécutez dans l’ordre les quatre fichiers du
            dossier <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">supabase/migrations/</code>.
          </Step>

          <Step index={4} title="Désactiver la confirmation d’e-mail">
            Dans <em>Authentication → Sign In / Providers → Email</em>, désactivez{' '}
            <em>Confirm email</em>. Sans cela, les comptes de test restent bloqués faute de boîte
            mail accessible.
          </Step>

          <Step index={5} title="Redémarrer le serveur de développement">
            Vite ne relit les variables d’environnement qu’au démarrage.
            <pre className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-xs text-ink">
              <Terminal className="h-3.5 w-3.5 shrink-0" aria-hidden />
              npm run dev
            </pre>
          </Step>
        </ol>

        <p className="mt-5 border-t border-line pt-4 text-sm text-ink-muted">
          La procédure complète, y compris le test de synchronisation à deux fenêtres, figure dans
          le <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">README.md</code>.
        </p>
      </div>
    </div>
  );
}

function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand"
      >
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}
