/**
 * Reflet TypeScript du schéma Supabase (`supabase/migrations/`).
 *
 * Écrit à la main plutôt que généré : le projet doit compiler avant qu'un
 * projet Supabase existe. Si tu régénères avec `supabase gen types typescript`,
 * remplace ce fichier — les types applicatifs de `domain.ts` en dérivent.
 */

export type OwnerSlot = 'partnerA' | 'partnerB' | 'shared';
/** Occupant réel d'une place du foyer : « shared » désigne le pot commun. */
export type PartnerSlot = Exclude<OwnerSlot, 'shared'>;
export type OwnerType = 'private' | 'shared';
export type MemberRole = 'owner' | 'editor' | 'viewer';
export type ExpenseKind = 'fixed' | 'variable';
export type BillStatus = 'paid' | 'pending' | 'overdue';
export type BillFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'biannual' | 'annual' | 'once';
export type InvestmentType =
  | 'real_estate'
  | 'stocks'
  | 'crypto'
  | 'life_insurance'
  | 'long_term_savings'
  | 'other';
export type IncomeType = 'salary' | 'bonus' | 'freelance' | 'benefits' | 'rental' | 'other';
export type AlertLevel = 'info' | 'warning' | 'critical';

/** Colonnes présentes sur toutes les tables financières. */
interface FinancialRecordBase {
  id: string;
  household_id: string;
  created_by: string;
  owner: OwnerSlot;
  /** Colonne générée par Postgres à partir de `owner` — jamais écrite côté client. */
  owner_type: OwnerType;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Colonnes de période, générées par Postgres à partir de `date`. */
interface PeriodColumns {
  date: string;
  year: number;
  month: number;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdRow {
  id: string;
  name: string;
  invite_code: string;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMemberRow {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRole;
  partner_slot: PartnerSlot;
  joined_at: string;
}

export interface IncomeRow extends FinancialRecordBase, PeriodColumns {
  amount: number;
  income_type: IncomeType;
  label: string;
}

export interface ExpenseRow extends FinancialRecordBase, PeriodColumns {
  amount: number;
  category: string;
  subcategory: string | null;
  kind: ExpenseKind;
  /** Qui a réglé — indépendant de `owner` : une dépense commune a un payeur. */
  paid_by: PartnerSlot;
  label: string;
}

export interface BillRow extends FinancialRecordBase, PeriodColumns {
  amount: number;
  label: string;
  category: string;
  frequency: BillFrequency;
  status: BillStatus;
}

export interface SavingsGoalRow extends FinancialRecordBase {
  name: string;
  target_amount: number;
  target_date: string | null;
}

/** Vue `savings_goals_with_progress` : montant courant calculé, jamais stocké. */
export interface SavingsGoalWithProgressRow extends SavingsGoalRow {
  current_amount: number;
  progress_percent: number;
}

export interface SavingsContributionRow extends FinancialRecordBase, PeriodColumns {
  goal_id: string;
  /** Négatif pour un retrait. */
  amount: number;
}

export interface InvestmentRow extends FinancialRecordBase, PeriodColumns {
  label: string;
  investment_type: InvestmentType;
  invested_amount: number;
  current_value: number;
}

export interface CategoryBudgetRow extends FinancialRecordBase {
  category: string;
  monthly_limit: number;
}

export interface NotificationRow {
  id: string;
  household_id: string;
  user_id: string;
  type: string;
  severity: AlertLevel;
  title: string;
  body: string;
  dedupe_key: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface MonthlySnapshotRow {
  id: string;
  household_id: string;
  user_id: string;
  year: number;
  month: number;
  payload: unknown;
  computed_at: string;
}

/**
 * Retour de la RPC `household_totals` : les totaux du foyer entier, les deux
 * parts privées comprises. Uniquement des sommes — aucune ligne de détail ne
 * franchit la frontière, c'est tout l'objet de la fonction `security definer`.
 */
export interface HouseholdTotalsRow {
  total_income: number;
  total_expenses: number;
  fixed_expenses: number;
  variable_expenses: number;
  total_bills: number;
  unpaid_bills: number;
  total_savings: number;
  total_invested: number;
  total_outflow: number;
  remaining_to_live: number;
}

/**
 * Colonnes que le client ne fournit jamais : soit générées par Postgres,
 * soit posées par un trigger.
 */
type ServerManaged = 'id' | 'owner_type' | 'year' | 'month' | 'created_at' | 'updated_at' | 'deleted_at';

/** Charge utile d'insertion pour une table financière. */
export type InsertPayload<T> = Omit<T, ServerManaged & keyof T>;

/** Charge utile de mise à jour : tout est optionnel sauf les colonnes serveur. */
export type UpdatePayload<T> = Partial<
  Omit<T, (ServerManaged & keyof T) | 'household_id' | 'created_by'>
>;
