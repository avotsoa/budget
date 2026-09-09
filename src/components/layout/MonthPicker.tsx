import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { capitalize, formatMonthLabel } from '@/lib/format';
import { useScope } from '@/hooks/useScope';

export function MonthPicker() {
  const { year, month, shiftPeriod, goToCurrentMonth, isCurrentMonth } = useScope();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => shiftPeriod(-1)}
        aria-label="Mois précédent"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>

      <span className="min-w-[8.5rem] text-center text-sm font-medium text-ink">
        {capitalize(formatMonthLabel(year, month))}
      </span>

      <Button variant="ghost" size="icon" onClick={() => shiftPeriod(1)} aria-label="Mois suivant">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>

      {/* Repère de retour : sans lui, on se perd vite en naviguant loin. */}
      {!isCurrentMonth ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={goToCurrentMonth}
          leadingIcon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
        >
          Aujourd’hui
        </Button>
      ) : null}
    </div>
  );
}
