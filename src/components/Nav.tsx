'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Award, TrendingUp } from 'lucide-react';

const links = [
  { href: '/', label: 'Leaderboard', icon: BarChart3 },
  { href: '/quality', label: 'Reports', icon: Award },
  { href: '/trends', label: 'Metrics', icon: TrendingUp },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-70">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card-dark">
            <span className="text-xs font-extrabold tracking-tight text-card-dark-foreground">K</span>
          </div>
          <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">Sales Intel</span>
        </Link>

        <nav className="flex flex-1 items-center justify-center" role="navigation" aria-label="Main navigation">
          {links.map(l => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex h-14 items-center gap-2 px-4 text-[13px] transition-colors ${
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <l.icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
                <span className="hidden sm:inline">{l.label}</span>
                {active && (
                  <span className="absolute inset-x-4 -bottom-px h-[2px] rounded-full bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
