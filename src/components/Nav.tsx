'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Award, TrendingUp, Zap } from 'lucide-react';

const links = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/quality', label: 'Quality', icon: Award },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 flex items-center h-14 gap-8">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-foreground">KIN Intel</span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map(l => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}>
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
