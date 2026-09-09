import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { useHousehold } from '@/hooks/useHousehold';

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  /** Nom de l'élément, repris dans la demande de confirmation. */
  itemLabel: string;
  isDeleting?: boolean;
}

/**
 * Actions de ligne, masquées pour un rôle `viewer`.
 *
 * Le masquage est un confort : la RLS rejetterait de toute façon l'écriture.
 */
export function RowActions({ onEdit, onDelete, itemLabel, isDeleting = false }: RowActionsProps) {
  const { canWrite } = useHousehold();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!canWrite) return null;

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Modifier ${itemLabel}`}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsConfirmOpen(true)}
          aria-label={`Supprimer ${itemLabel}`}
          className="hover:text-critical"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          onDelete();
          setIsConfirmOpen(false);
        }}
        title="Confirmer la suppression"
        message={`Supprimer « ${itemLabel} » ? Cette ligne disparaîtra aussi chez votre partenaire si elle est commune.`}
        isPending={isDeleting}
      />
    </>
  );
}
