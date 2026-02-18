'use client';
import { format, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

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
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-500" />
      <span className="text-sm text-gray-300">
        {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
      </span>
      <div className="flex items-center gap-1 ml-2">
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {weekOffset > 0 && (
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(() => 0)} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition">
            Today
          </button>
        )}
      </div>
    </div>
  );
}
