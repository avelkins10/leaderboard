'use client';
import { format, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekPickerProps {
  weekOffset: number;
  setWeekOffset: (fn: (w: number) => number) => void;
}

export function useWeekDates(weekOffset: number) {
  const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 0 });
  const weekEnd = weekOffset === 0 ? new Date() : endOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 0 });
  const from = format(weekStart, 'yyyy-MM-dd');
  const to = format(addDays(weekEnd, 1), 'yyyy-MM-dd');
  return { weekStart, weekEnd, from, to };
}

export function WeekPicker({ weekOffset, setWeekOffset }: WeekPickerProps) {
  const { weekStart, weekEnd } = useWeekDates(weekOffset);
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1">
      <button
        onClick={() => setWeekOffset(w => w + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-default hover:bg-secondary hover:text-foreground"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[140px] text-center text-[13px] font-medium tabular-nums text-foreground">
        {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
      </span>
      {weekOffset > 0 ? (
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-default hover:bg-secondary hover:text-foreground"
          aria-label="Next week"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="h-7 w-7" />
      )}
      {weekOffset !== 0 && (
        <button
          onClick={() => setWeekOffset(() => 0)}
          className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-default hover:bg-primary/20"
        >
          Today
        </button>
      )}
    </div>
  );
}
