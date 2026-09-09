import { useCallback, useEffect, useState } from 'react';

/** Événement non standard, implémenté par Chrome et les navigateurs Chromium. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __installPromptEvent: BeforeInstallPromptEvent | null;
  }
}

function detectStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS n'implémente pas `display-mode` et expose ce drapeau à la place.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function detectIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * État d'installabilité de la PWA.
 *
 * Trois cas distincts, car aucun navigateur ne se comporte pareil :
 * - déjà installée → ne rien proposer ;
 * - Chromium → un vrai bouton déclenchant l'invite native ;
 * - iOS → aucune API d'installation, il faut expliquer le geste manuel.
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => Boolean(window.__installPromptEvent));
  const [isStandalone, setIsStandalone] = useState(detectStandalone);
  const isIOS = detectIOS();

  useEffect(() => {
    const handleInstallable = () => setCanInstall(true);
    const handleInstalled = () => {
      setCanInstall(false);
      setIsStandalone(true);
    };

    window.addEventListener('pwa:installable', handleInstallable);
    window.addEventListener('pwa:installed', handleInstalled);

    // L'événement a pu être capté par le script inline avant ce montage.
    if (window.__installPromptEvent) setCanInstall(true);

    const media = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (event: MediaQueryListEvent) => setIsStandalone(event.matches);
    media.addEventListener('change', handleDisplayChange);

    return () => {
      window.removeEventListener('pwa:installable', handleInstallable);
      window.removeEventListener('pwa:installed', handleInstalled);
      media.removeEventListener('change', handleDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = window.__installPromptEvent;
    if (!event) return 'unavailable' as const;

    await event.prompt();
    const { outcome } = await event.userChoice;

    // L'invite native n'est utilisable qu'une fois : le navigateur en émettra
    // une nouvelle s'il juge l'application toujours installable.
    window.__installPromptEvent = null;
    setCanInstall(false);

    return outcome;
  }, []);

  return {
    /** Vrai quand l'invite native est disponible (Chromium uniquement). */
    canInstall,
    /** Vrai quand l'application tourne déjà en mode installé. */
    isStandalone,
    /** iOS n'expose aucune API : l'installation passe par le menu Partager. */
    isIOS,
    promptInstall,
  };
}
