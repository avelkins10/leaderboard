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

const colorMap = {
  default: 'text-foreground',
  green: 'text-primary',
  blue: 'text-info',
  yellow: 'text-warning',
  red: 'text-destructive',
};

export function MetricCard({ label, value, subtitle, tooltip, icon, trend, color = 'default' }: MetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-muted-foreground/20 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${colorMap[color]}`}>{value}</div>
      <div className="flex items-center gap-2 mt-1">
        {subtitle && <span className="text-muted-foreground text-sm">{subtitle}</span>}
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-primary' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
