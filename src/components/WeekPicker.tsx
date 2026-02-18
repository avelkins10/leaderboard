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
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card">
      <button
        onClick={() => setWeekOffset(w => w + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="flex h-8 min-w-[140px] items-center justify-center border-x border-border px-3 text-[12px] font-medium tabular-nums text-foreground font-mono">
        {format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d')}
      </span>
      {weekOffset > 0 ? (
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Next week"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="h-8 w-8" />
      )}
      {weekOffset !== 0 && (
        <button
          onClick={() => setWeekOffset(() => 0)}
          className="mr-0.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          Now
        </button>
      )}
    </div>
  );
}
