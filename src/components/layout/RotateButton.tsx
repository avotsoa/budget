import { toast } from 'sonner';
import { RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOrientationLock } from '@/hooks/useOrientationLock';

/**
 * Bascule paysage / portrait depuis l'application.
 *
 * Masqué sur grand écran — la rotation n'a de sens qu'au téléphone — et
 * masqué aussi quand le navigateur n'expose pas l'API, iOS notamment : mieux
 * vaut pas de bouton qu'un bouton qui ne fait rien.
 */
export function RotateButton() {
  const { isSupported, isLocked, lockLandscape, unlock } = useOrientationLock();

  if (!isSupported) return null;

  async function handleClick() {
    if (isLocked) {
      await unlock();
      return;
    }

    const succeeded = await lockLandscape();
    if (!succeeded) {
      toast.error('Rotation impossible', {
        description:
          'Installez l’application sur votre écran d’accueil, ou activez la rotation automatique du téléphone.',
        duration: 6000,
      });
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden"
      onClick={() => void handleClick()}
      aria-label={isLocked ? 'Revenir à l’orientation normale' : 'Passer en mode paysage'}
      title={isLocked ? 'Orientation normale' : 'Mode paysage'}
    >
      {isLocked ? (
        <RotateCcw className="h-4 w-4" aria-hidden />
      ) : (
        <RotateCw className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
