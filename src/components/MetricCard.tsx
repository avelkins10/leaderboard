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

const accentMap: Record<string, string> = {
  default: 'text-foreground',
  green: 'text-primary',
  blue: 'text-info',
  yellow: 'text-warning',
  red: 'text-destructive',
};

export function MetricCard({ label, value, subtitle, tooltip, icon, trend, color = 'default' }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-all duration-200 hover:border-border hover:bg-card/80">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {icon && <span className="text-muted-foreground/20">{icon}</span>}
      </div>
      <div className="mt-3">
        <span className={`text-[32px] font-semibold tracking-tighter font-mono leading-none ${accentMap[color]}`}>
          {value}
        </span>
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="mt-2.5 flex items-center gap-2">
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
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
