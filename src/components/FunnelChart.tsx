'use client';

interface FunnelStep { label: string; value: number; color: string; }

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map(s => s.value), 1);
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = (step.value / max) * 100;
        const convRate = i > 0 && steps[i - 1].value > 0
          ? ((step.value / steps[i - 1].value) * 100).toFixed(1)
          : null;
        return (
          <div key={step.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-muted-foreground">{step.label}</span>
              <div className="flex items-center gap-3">
                {convRate && <span className="text-[11px] font-mono text-muted-foreground/50">{convRate}%</span>}
                <span className="text-sm font-semibold font-mono tabular-nums" style={{ color: step.color }}>{step.value}</span>
              </div>
            </div>
            <div className="h-7 overflow-hidden rounded-lg bg-secondary/50">
              <div
                className="h-full rounded-lg transition-all duration-700 ease-out"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: step.color, opacity: 0.5 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
