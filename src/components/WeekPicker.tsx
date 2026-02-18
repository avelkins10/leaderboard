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
    <div className="inline-flex items-center rounded-lg border border-border bg-card text-sm">
      <button
        onClick={() => setWeekOffset(w => w + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="flex h-9 min-w-[148px] items-center justify-center border-x border-border px-3 text-xs font-medium tabular-nums text-foreground font-mono">
        {format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d')}
      </span>
      {weekOffset > 0 ? (
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="h-9 w-9" />
      )}
      {weekOffset !== 0 && (
        <button
          onClick={() => setWeekOffset(() => 0)}
          className="mr-1 rounded-md px-2.5 py-1 text-2xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Today
        </button>
      )}
    </div>
  );
}
