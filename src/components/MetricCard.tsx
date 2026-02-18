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

const valueColor = {
  default: 'text-foreground',
  green: 'text-primary',
  blue: 'text-info',
  yellow: 'text-warning',
  red: 'text-destructive',
};

export function MetricCard({ label, value, subtitle, tooltip, icon, trend, color = 'default' }: MetricCardProps) {
  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-default hover:border-muted-foreground/25">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {icon && <span className="text-muted-foreground/40 transition-default group-hover:text-muted-foreground/60">{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight font-mono ${valueColor[color]}`}>
        {value}
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="mt-1 flex items-center gap-2">
          {subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}
          {trend !== undefined && (
            <span className={`text-xs font-medium font-mono ${trend > 0 ? 'text-primary' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
