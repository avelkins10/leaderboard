'use client';
import { ReactNode } from 'react';

export function Section({ title, subtitle, children, action, noPadding }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </section>
  );
}
