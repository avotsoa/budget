import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

/**
 * Invite à installer l'application sur l'écran d'accueil.
 *
 * Aucun navigateur n'affiche de bouton dans la page : Chrome enfouit l'option
 * dans son menu, Safari n'en propose aucune. D'où ce bouton explicite, qui
 * déclenche l'invite native quand elle existe et explique le geste sinon.
 */
export function InstallButton({ variant = 'inline' }: { variant?: 'inline' | 'banner' }) {
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Déjà installée, ou l'utilisateur a écarté la proposition : ne rien montrer.
  if (isStandalone || isDismissed) return null;
  if (!canInstall && !isIOS) return null;

  if (variant === 'inline') {
    return (
      <>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => (isIOS ? setShowIOSHelp(true) : void promptInstall())}
          leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden />}
        >
          Installer
        </Button>
        {showIOSHelp ? <IOSHelp onClose={() => setShowIOSHelp(false)} /> : null}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          'mb-4 flex items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 p-3',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-ink">
          <Download className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Installer l’application</p>
          <p className="text-xs text-ink-2">
            Une icône sur votre écran d’accueil, sans barre d’adresse.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => (isIOS ? setShowIOSHelp(true) : void promptInstall())}
        >
          Installer
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDismissed(true)}
          aria-label="Masquer la proposition d’installation"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      {showIOSHelp ? <IOSHelp onClose={() => setShowIOSHelp(false)} /> : null}
    </>
  );
}

/** Safari n'expose aucune API d'installation : seule l'explication reste. */
function IOSHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-line bg-surface p-4 shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink">Installer sur iPhone</p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      <ol className="mt-2 space-y-1.5 text-sm text-ink-2">
        <li className="flex items-center gap-2">
          <Share className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          Touchez le bouton Partager, en bas de Safari
        </li>
        <li>Faites défiler jusqu’à « Sur l’écran d’accueil »</li>
        <li>Confirmez avec « Ajouter »</li>
      </ol>
    </div>
  );
}
