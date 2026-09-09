import { z } from 'zod';
import { OWNER_SLOTS, PARTNER_SLOTS } from '@/lib/constants';
import { useHousehold } from '@/hooks/useHousehold';

/**
 * Schémas zod partagés par tous les formulaires financiers.
 *
 * Les montants arrivent d'un `<input type="number">` : la valeur brute est
 * une chaîne, qu'on convertit puis valide. `z.coerce` seul accepterait
 * silencieusement une chaîne vide comme 0.
 */
export const amountSchema = z
  .string()
  .min(1, 'Montant requis')
  .refine((value) => !Number.isNaN(Number(value)), 'Montant invalide')
  .refine((value) => Number(value) > 0, 'Le montant doit être supérieur à 0')
  .transform((value) => Number(value));

/** Variante autorisant les valeurs négatives — utilisée pour les retraits. */
export const signedAmountSchema = z
  .string()
  .min(1, 'Montant requis')
  .refine((value) => !Number.isNaN(Number(value)), 'Montant invalide')
  .refine((value) => Number(value) !== 0, 'Le montant ne peut pas être nul')
  .transform((value) => Number(value));

export const dateSchema = z
  .string()
  .min(1, 'Date requise')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

export const ownerSchema = z.enum(['partnerA', 'partnerB', 'shared']);
export const partnerSchema = z.enum(['partnerA', 'partnerB']);
export const noteSchema = z.string().trim().max(500, 'Note trop longue').optional();

/**
 * Options du champ « propriétaire ».
 *
 * Un utilisateur ne peut créer une donnée privée qu'à son propre nom : la
 * policy d'insertion l'interdit de toute façon côté serveur, autant ne pas
 * proposer un choix voué à échouer.
 */
export function useOwnerOptions() {
  const { mySlot, ownerLabel } = useHousehold();

  return OWNER_SLOTS.filter((slot) => slot === 'shared' || slot === mySlot).map((slot) => ({
    value: slot,
    label: slot === 'shared' ? 'Commun (visible par les deux)' : `${ownerLabel(slot)} (privé)`,
  }));
}

/** Options du champ « payé par » : les deux places, quel que soit le propriétaire. */
export function usePayerOptions() {
  const { ownerLabel } = useHousehold();

  return PARTNER_SLOTS.map((slot) => ({ value: slot, label: ownerLabel(slot) }));
}
