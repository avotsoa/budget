/**
 * Libellés français et référentiels partagés.
 *
 * Source unique pour les listes déroulantes, les tableaux et les graphiques :
 * un libellé ne doit jamais être écrit en dur dans un composant.
 */

import type {
  BillFrequency,
  BillStatus,
  ExpenseKind,
  IncomeType,
  InvestmentType,
  MemberRole,
  OwnerSlot,
  PartnerSlot,
} from '@/types/database';

/**
 * Devise de l'application — source unique.
 *
 * Pour passer à une autre monnaie, seules ces quatre valeurs changent :
 * les formateurs, les libellés de formulaire et le pas de saisie en dérivent.
 * Exemple pour la zone euro : code `EUR`, locale `fr-FR`, symbole `€`,
 * `decimals: 2`.
 */
export const CURRENCY = {
  code: 'MGA',
  locale: 'fr-MG',
  symbol: 'Ar',
  /** L'ariary ne se subdivise pas en pratique : montants entiers. */
  decimals: 0,
} as const;

/** Pas du champ de saisie, cohérent avec le nombre de décimales de la devise. */
export const AMOUNT_STEP = CURRENCY.decimals === 0 ? '1' : '0.01';

/** Slot de série data-viz — la couleur suit l'entité, jamais son rang. */
export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const EXPENSE_CATEGORIES = [
  'Alimentation',
  'Logement',
  'Transport',
  'Santé',
  'Loisirs',
  'Abonnements',
  'Shopping',
  'Restaurants',
  'Éducation',
  'Enfants',
  'Animaux',
  'Divers',
] as const;

export const BILL_CATEGORIES = [
  'Logement',
  'Énergie',
  'Télécom',
  'Assurance',
  'Santé',
  'Transport',
  'Abonnements',
  'Impôts',
  'Divers',
] as const;

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary: 'Salaire',
  bonus: 'Prime',
  freelance: 'Freelance',
  benefits: 'Allocations',
  rental: 'Revenus locatifs',
  other: 'Autre',
};

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  fixed: 'Fixe',
  variable: 'Variable',
};

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  paid: 'Payée',
  pending: 'À payer',
  overdue: 'En retard',
};

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  monthly: 'Mensuelle',
  bimonthly: 'Bimestrielle',
  quarterly: 'Trimestrielle',
  biannual: 'Semestrielle',
  annual: 'Annuelle',
  once: 'Ponctuelle',
};

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  real_estate: 'Immobilier',
  stocks: 'Actions',
  crypto: 'Crypto',
  life_insurance: 'Assurance-vie',
  long_term_savings: 'Épargne long terme',
  other: 'Autre',
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propriétaire',
  editor: 'Éditeur',
  viewer: 'Lecteur',
};

export const MEMBER_ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: 'Gère le foyer, les rôles et le code d’invitation.',
  editor: 'Ajoute et modifie les données communes et les siennes.',
  viewer: 'Consulte uniquement, sans pouvoir modifier.',
};

/** Périmètre de lecture appliqué globalement à toutes les pages. */
export type ScopeFilter = 'couple' | 'mine' | 'shared';

/**
 * « Ma vue complète » et non « Vue couple » : ce périmètre n'est pas celui du
 * foyer, c'est celui de l'utilisateur. Le privé du partenaire n'y figure pas,
 * et les deux partenaires y lisent donc deux totaux différents. Le vrai total
 * du foyer vient de la RPC `household_totals`.
 */
export const SCOPE_LABELS: Record<ScopeFilter, string> = {
  couple: 'Ma vue complète',
  mine: 'Mes données',
  shared: 'Données partagées',
};

export const SCOPE_DESCRIPTIONS: Record<ScopeFilter, string> = {
  couple: 'Vos lignes et le commun. Le privé de votre partenaire en est exclu.',
  mine: 'Uniquement les lignes qui vous sont attribuées.',
  shared: 'Uniquement le pot commun du foyer.',
};

/**
 * Couleur de série par propriétaire. Fixe et stable : un filtre qui réduit le
 * nombre de séries ne doit jamais repeindre les survivantes.
 */
export const OWNER_SERIES_SLOT: Record<OwnerSlot, SeriesSlot> = {
  partnerA: 1,
  partnerB: 2,
  shared: 3,
};

/** Ordre d'affectation des couleurs catégorielles — jamais recyclé au-delà de 8. */
export const SERIES_SLOTS: readonly SeriesSlot[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const PARTNER_SLOTS: readonly PartnerSlot[] = ['partnerA', 'partnerB'];

export const OWNER_SLOTS: readonly OwnerSlot[] = ['partnerA', 'partnerB', 'shared'];

/** Nom par défaut d'une place, remplacé par le prénom réel dès qu'il est connu. */
export const DEFAULT_PARTNER_LABELS: Record<PartnerSlot, string> = {
  partnerA: 'Partenaire A',
  partnerB: 'Partenaire B',
};

export const SHARED_LABEL = 'Commun';

/** Seuils des règles d'alerte (voir `lib/finance/alerts.ts`). */
export const ALERT_THRESHOLDS = {
  /** Part du plafond de catégorie à partir de laquelle on prévient. */
  categoryWarningRatio: 0.85,
  /** Nombre de jours avant échéance déclenchant un rappel de facture. */
  billDueSoonDays: 7,
  /** Solde mensuel en dessous duquel on signale une fin de mois tendue. */
  lowBalance: 150,
  /** Baisse d'épargne d'un mois sur l'autre jugée significative. */
  savingsDropRatio: 0.3,
} as const;

export const STORAGE_KEYS = {
  theme: 'budget-couple:theme',
  scope: 'budget-couple:scope',
} as const;
