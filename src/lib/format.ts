import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CURRENCY } from './constants';

// Les montants suivent la locale de la devise ; les dates restent en français.
const currencyFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  minimumFractionDigits: CURRENCY.decimals,
  maximumFractionDigits: CURRENCY.decimals,
});

const compactCurrencyFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Format court pour les axes de graphique, où la place manque. */
export function formatCurrencyCompact(value: number): string {
  return compactCurrencyFormatter.format(value);
}

/** `ratio` est une proportion (0,42 → « 42,0 % »), pas un nombre déjà multiplié. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return percentFormatter.format(ratio);
}

/** Variation signée, pour les comparaisons au mois précédent. */
export function formatSignedPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  const sign = ratio > 0 ? '+' : '';
  return `${sign}${percentFormatter.format(ratio)}`;
}

export function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${currencyFormatter.format(value)}`;
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: fr });
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: fr });
}

/** « juillet 2026 » — titre de période. */
export function formatMonthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: fr });
}

/** « juil. 26 » — libellé d'axe, où la place est comptée. */
export function formatMonthShort(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMM yy', { locale: fr });
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Clé de tri et d'agrégation stable pour une période mensuelle. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-');
  return { year: Number(year), month: Number(month) };
}

/** Décale une période de `delta` mois, en gérant le passage d'année. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
  };
}

/** Les `n` derniers mois jusqu'à la période donnée, du plus ancien au plus récent. */
export function lastNMonths(
  year: number,
  month: number,
  n: number,
): Array<{ year: number; month: number }> {
  return Array.from({ length: n }, (_, index) => shiftMonth(year, month, index - (n - 1)));
}

export function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Date du jour au format `yyyy-MM-dd`, valeur par défaut des formulaires. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function daysUntil(iso: string): number {
  const target = parseISO(iso);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Initiales pour les pastilles d'avatar. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
