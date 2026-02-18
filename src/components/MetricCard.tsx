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

const subtitleAccent: Record<string, string> = {
  default: 'text-card-dark-foreground/50',
  green: 'text-primary',
  blue: 'text-info',
  yellow: 'text-warning',
  red: 'text-destructive',
};

export function MetricCard({ label, value, subtitle, tooltip, icon, trend, color = 'default' }: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-card-dark p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-card-dark-foreground/50">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {icon && <span className="text-card-dark-foreground/15">{icon}</span>}
      </div>
      <div className="mt-3">
        <span className="text-[32px] font-semibold tracking-tight font-mono leading-none text-card-dark-foreground">
          {value}
        </span>
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="mt-2 flex items-center gap-2">
          {subtitle && <span className={`text-xs font-medium ${subtitleAccent[color]}`}>{subtitle}</span>}
          {trend !== undefined && (
            <span className={`text-[11px] font-semibold font-mono ${trend > 0 ? 'text-primary' : trend < 0 ? 'text-destructive' : 'text-card-dark-foreground/40'}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
