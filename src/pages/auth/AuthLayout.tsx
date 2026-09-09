import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { InstallButton } from '@/components/layout/InstallButton';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-full items-center justify-center bg-plane p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-ink">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
        </div>

        {/* Proposée dès l'écran de connexion : c'est le premier écran vu sur
            mobile, et le moment naturel pour ajouter l'icône à l'accueil. */}
        <InstallButton variant="banner" />

        <div className="rounded-xl border border-line bg-surface p-6 shadow-card">{children}</div>

        {footer ? <div className="mt-4 text-center text-sm text-ink-2">{footer}</div> : null}
      </div>
    </div>
  );
}
