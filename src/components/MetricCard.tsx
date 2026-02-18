'use client';
import { ReactNode } from 'react';
import { Tooltip } from './Tooltip';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
  icon?: ReactNode;
  trend?: number;
  color?: 'default' | 'green' | 'blue' | 'yellow' | 'red';
}

const accentMap = {
  default: '',
  green: 'text-primary',
  blue: 'text-info',
  yellow: 'text-warning',
  red: 'text-destructive',
};

export function MetricCard({ label, value, subtitle, tooltip, icon, trend, color = 'default' }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className={`text-2xl font-semibold tracking-tight font-mono tabular-nums ${accentMap[color] || 'text-foreground'}`}>
          {value}
        </span>
        {icon && <span className="text-muted-foreground/30">{icon}</span>}
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="mt-1.5 flex items-center gap-2">
          {subtitle && <span className="text-[12px] text-muted-foreground">{subtitle}</span>}
          {trend !== undefined && (
            <span className={`text-[11px] font-semibold font-mono ${trend > 0 ? 'text-primary' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
