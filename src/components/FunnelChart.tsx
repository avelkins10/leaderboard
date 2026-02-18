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
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground text-xs font-medium">{step.label}</span>
              <div className="flex items-center gap-3">
                {convRate && <span className="text-muted-foreground/60 text-xs">{convRate}% conv.</span>}
                <span className="font-bold text-sm font-mono" style={{ color: step.color }}>{step.value}</span>
              </div>
            </div>
            <div className="h-7 bg-secondary rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: step.color, opacity: 0.7 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
