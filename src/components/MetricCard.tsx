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

const subtitleColorMap: Record<string, string> = {
  default: 'text-surface-inverted-muted',
  green: 'text-primary',
  blue: 'text-info',
  yellow: 'text-warning',
  red: 'text-destructive',
};

export function MetricCard({ label, value, subtitle, tooltip, icon, trend, color = 'default' }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-surface-inverted p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-surface-inverted-muted">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {icon && <span className="text-surface-inverted-muted/30">{icon}</span>}
      </div>
      <div className="mt-3">
        <span className="text-[30px] font-semibold tracking-tight font-mono leading-none text-surface-inverted-foreground">
          {value}
        </span>
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="mt-2.5 flex items-center gap-2">
          {subtitle && <span className={`text-xs ${subtitleColorMap[color]}`}>{subtitle}</span>}
          {trend !== undefined && (
            <span className={`text-[11px] font-semibold font-mono ${trend > 0 ? 'text-primary' : trend < 0 ? 'text-destructive' : 'text-surface-inverted-muted'}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
