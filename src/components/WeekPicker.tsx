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
    <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
      <button
        onClick={() => setWeekOffset(w => w + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[150px] text-center text-[13px] font-medium tabular-nums text-foreground font-mono">
        {format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d')}
      </span>
      {weekOffset > 0 ? (
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="h-8 w-8" />
      )}
      {weekOffset !== 0 && (
        <button
          onClick={() => setWeekOffset(() => 0)}
          className="rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          Today
        </button>
      )}
    </div>
  );
}
