'use client';

export function rateColor(value: number, good: number, ok: number): string {
  if (value >= good) return 'text-emerald-400';
  if (value >= ok) return 'text-yellow-400';
  return 'text-red-400';
}

export function rateBg(value: number, good: number, ok: number): string {
  if (value >= good) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (value >= ok) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-red-500/10 text-red-400 border-red-500/20';
}

export function StatusBadge({ value, good, ok, suffix = '%' }: { value: number; good: number; ok: number; suffix?: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${rateBg(value, good, ok)}`}>
      {value}{suffix}
    </span>
  );
}
