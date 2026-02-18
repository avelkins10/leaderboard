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

const valueColor: Record<string, string> = {
  default: 'text-foreground',
  green: 'text-primary',
  blue: 'text-info',
  yellow: 'text-warning',
  red: 'text-destructive',
};

export function MetricCard({ label, value, subtitle, tooltip, icon, trend, color = 'default' }: MetricCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-muted-foreground/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {icon && <span className="text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/40">{icon}</span>}
      </div>
      <div className="mt-2">
        <span className={`text-[28px] font-semibold tracking-tight font-mono tabular-nums leading-none ${valueColor[color]}`}>
          {value}
        </span>
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="mt-2 flex items-center gap-2">
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
