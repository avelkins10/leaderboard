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
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={noPadding ? '' : 'px-6 pb-6'}>{children}</div>
    </section>
  );
}
