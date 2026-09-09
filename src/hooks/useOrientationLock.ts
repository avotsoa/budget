import { useCallback, useEffect, useRef, useState } from 'react';

/** `lock` reste absente de certaines définitions DOM selon la cible TS. */
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait' | 'natural') => Promise<void>;
};

function getOrientation(): LockableOrientation | null {
  if (typeof window === 'undefined' || !window.screen?.orientation) return null;
  return window.screen.orientation as LockableOrientation;
}

function detectSupport(): boolean {
  return typeof getOrientation()?.lock === 'function';
}

function isLandscapeNow(): boolean {
  const type = getOrientation()?.type;
  return type ? type.startsWith('landscape') : window.innerWidth > window.innerHeight;
}

/**
 * Verrouillage de l'orientation depuis l'application.
 *
 * `screen.orientation.lock()` n'est autorisée que si le document est en plein
 * écran, ou s'il s'agit d'une PWA installée en `standalone`. Dans un simple
 * onglet, on bascule donc d'abord en plein écran — ce qui, sur un téléphone,
 * rend de toute façon la place gagnée plus utile.
 *
 * iOS ne l'implémente pas du tout : `isSupported` y sera faux, et le bouton
 * doit rester masqué plutôt que d'échouer en silence.
 */
export function useOrientationLock() {
  const [isSupported] = useState(detectSupport);
  const [isLocked, setIsLocked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(isLandscapeNow);

  // Le plein écran n'est quitté que si c'est nous qui l'avons demandé :
  // l'utilisateur a pu l'activer lui-même auparavant.
  const didRequestFullscreen = useRef(false);

  useEffect(() => {
    const orientation = getOrientation();
    if (!orientation) return;

    const handleChange = () => setIsLandscape(isLandscapeNow());
    orientation.addEventListener('change', handleChange);
    return () => orientation.removeEventListener('change', handleChange);
  }, []);

  const unlock = useCallback(async () => {
    getOrientation()?.unlock();
    setIsLocked(false);

    if (didRequestFullscreen.current && document.fullscreenElement) {
      didRequestFullscreen.current = false;
      await document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  /** Verrouille en paysage. Renvoie `false` si le navigateur a refusé. */
  const lockLandscape = useCallback(async () => {
    const orientation = getOrientation();
    if (!orientation?.lock) return false;

    try {
      await orientation.lock('landscape');
      setIsLocked(true);
      return true;
    } catch {
      // Refus le plus courant : hors PWA installée, le plein écran est requis.
      try {
        await document.documentElement.requestFullscreen();
        didRequestFullscreen.current = true;
        await orientation.lock('landscape');
        setIsLocked(true);
        return true;
      } catch {
        didRequestFullscreen.current = false;
        return false;
      }
    }
  }, []);

  return { isSupported, isLocked, isLandscape, lockLandscape, unlock };
}
