'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardCheck, TrendingUp } from 'lucide-react';

const links = [
  { href: '/', label: 'Leaderboard', icon: BarChart3 },
  { href: '/quality', label: 'Reports', icon: ClipboardCheck },
  { href: '/trends', label: 'Metrics', icon: TrendingUp },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center px-6 lg:px-10">
        {/* Logo -- left-aligned, fixed width so nav stays centered */}
        <div className="w-[180px] shrink-0">
          <Link href="/" className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-70">
            <Image src="/logo.png" alt="KIN" width={24} height={24} className="h-6 w-6" />
            <span className="text-sm font-bold tracking-[-0.02em] text-foreground">KIN PULSE</span>
          </Link>
        </div>

        {/* Centered nav links */}
        <nav className="flex flex-1 items-center justify-center gap-1" role="navigation" aria-label="Main navigation">
          {links.map(l => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex h-14 items-center gap-2 px-5 text-[13px] transition-colors ${
                  active
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted-foreground hover:text-foreground'
                }`}
              >
                <l.icon className="h-4 w-4" strokeWidth={active ? 2.25 : 1.5} />
                <span className="hidden sm:inline">{l.label}</span>
                {active && (
                  <span className="absolute inset-x-4 -bottom-px h-[2px] rounded-full bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right spacer to balance the logo */}
        <div className="w-[180px] shrink-0" />
      </div>
    </header>
  );
}
