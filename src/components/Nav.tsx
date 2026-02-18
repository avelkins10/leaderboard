'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Building2, TrendingUp, Award, Zap } from 'lucide-react';

const links = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/quality', label: 'Quality', icon: Award },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 flex items-center h-14 gap-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span>KIN Sales Intel</span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map(l => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}>
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
