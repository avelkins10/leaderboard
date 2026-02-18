'use client';

export function rateColor(value: number, good: number, ok: number): string {
  if (value >= good) return 'text-primary';
  if (value >= ok) return 'text-warning';
  return 'text-destructive';
}

export function rateBg(value: number, good: number, ok: number): string {
  if (value >= good) return 'bg-primary/10 text-primary';
  if (value >= ok) return 'bg-warning/10 text-warning';
  return 'bg-destructive/10 text-destructive';
}

export function StatusBadge({ value, good, ok, suffix = '%' }: { value: number; good: number; ok: number; suffix?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-semibold font-mono tabular-nums leading-none ${rateBg(value, good, ok)}`}>
      {value}{suffix}
    </span>
  );
}
