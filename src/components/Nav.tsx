'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Award, TrendingUp } from 'lucide-react';

const links = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/quality', label: 'Quality', icon: Award },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[11px] font-extrabold text-primary-foreground">K</span>
          <span className="text-sm font-semibold tracking-tight text-foreground">Sales Intel</span>
        </Link>

        <nav className="flex items-center gap-0.5" role="navigation" aria-label="Main navigation">
          {links.map(l => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <l.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{l.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
