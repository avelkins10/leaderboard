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
    <header className="sticky top-0 z-50 border-b border-border bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">K</span>
          <span className="hidden sm:inline">KIN Intel</span>
        </Link>

        <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
          {links.map(l => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-default ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <l.icon className="h-3.5 w-3.5" />
                {l.label}
                {active && (
                  <span className="absolute -bottom-[9px] left-3 right-3 h-px bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
