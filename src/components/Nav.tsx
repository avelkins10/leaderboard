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
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <span className="text-[10px] font-black tracking-tighter text-primary-foreground">K</span>
          </div>
          <span className="text-[13px] font-semibold text-foreground">Sales Intel</span>
        </Link>

        <nav className="flex items-center" role="navigation" aria-label="Main navigation">
          {links.map(l => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex h-12 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <l.icon className="h-3.5 w-3.5" strokeWidth={active ? 2.5 : 2} />
                <span className="hidden sm:inline">{l.label}</span>
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-px bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
