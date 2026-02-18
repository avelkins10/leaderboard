'use client';

export function rateColor(value: number, good: number, ok: number): string {
  if (value >= good) return 'text-primary';
  if (value >= ok) return 'text-warning';
  return 'text-destructive';
}

export function rateBg(value: number, good: number, ok: number): string {
  if (value >= good) return 'bg-primary/10 text-primary border-primary/20';
  if (value >= ok) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
}

export function StatusBadge({ value, good, ok, suffix = '%' }: { value: number; good: number; ok: number; suffix?: string }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${rateBg(value, good, ok)}`}>
      {value}{suffix}
    </span>
  );
}
