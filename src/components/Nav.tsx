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
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-1 px-5 sm:px-8">
        <Link href="/" className="mr-6 flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-[11px] font-extrabold tracking-tight text-primary-foreground">K</span>
          </div>
          <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">Sales Intel</span>
        </Link>

        <nav className="flex items-center" role="navigation" aria-label="Main navigation">
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
                <l.icon className="h-[15px] w-[15px]" strokeWidth={active ? 2 : 1.5} />
                <span className="hidden sm:inline">{l.label}</span>
                {active && (
                  <span className="absolute inset-x-4 -bottom-px h-[2px] rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
