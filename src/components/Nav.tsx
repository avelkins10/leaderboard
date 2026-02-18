"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Users,
  ClipboardCheck,
  TrendingUp,
} from "lucide-react";
import { preload } from "swr";
import { fetcher } from "@/lib/swr";
import { computePreset } from "@/hooks/useDateRange";

const links = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "Home",
    icon: BarChart3,
    apiPrefix: "/api/scorecard",
    presetKey: "today" as const,
  },
  {
    href: "/office",
    label: "Offices",
    shortLabel: "Offices",
    icon: Building2,
    apiPrefix: "/api/scorecard",
    presetKey: "this-week" as const,
  },
  {
    href: "/rep",
    label: "Reps",
    shortLabel: "Reps",
    icon: Users,
    apiPrefix: "/api/scorecard",
    presetKey: "this-week" as const,
  },
  {
    href: "/quality",
    label: "Quality",
    shortLabel: "Quality",
    icon: ClipboardCheck,
    apiPrefix: "/api/scorecard",
    presetKey: "this-week" as const,
  },
  {
    href: "/trends",
    label: "Trends",
    shortLabel: "Trends",
    icon: TrendingUp,
    apiPrefix: "/api/trends",
    presetKey: "last-30" as const,
  },
];

export function Nav() {
  const path = usePathname();
  const handlePreload = (l: (typeof links)[number]) => {
    const { from, to } = computePreset(l.presetKey);
    preload(`${l.apiPrefix}?from=${from}&to=${to}`, fetcher);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center px-4 sm:px-6 lg:px-10">
        {/* Logo */}
        <div className="w-auto sm:w-[140px] lg:w-[180px] shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-70"
          >
            <Image
              src="/logo.png"
              alt="KIN"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-sm font-bold tracking-[-0.02em] text-foreground hidden sm:inline">
              KIN PULSE
            </span>
          </Link>
        </div>

        {/* Nav links — centered on desktop, scrollable on mobile */}
        <nav
          className="flex flex-1 items-center justify-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none"
          role="navigation"
          aria-label="Main navigation"
        >
          {links.map((l) => {
            const active =
              l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onMouseEnter={() => handlePreload(l)}
                className={`relative flex h-14 items-center gap-1.5 px-3 sm:px-4 text-[12px] sm:text-[13px] transition-colors whitespace-nowrap ${
                  active
                    ? "font-semibold text-foreground"
                    : "font-medium text-muted-foreground hover:text-foreground"
                }`}
              >
                <l.icon
                  className="h-4 w-4 shrink-0"
                  strokeWidth={active ? 2.25 : 1.5}
                />
                <span className="hidden sm:inline">{l.label}</span>
                <span className="sm:hidden">{l.shortLabel}</span>
                {active && (
                  <span className="absolute inset-x-3 sm:inset-x-4 -bottom-px h-[2px] rounded-full bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right spacer */}
        <div className="w-0 sm:w-[140px] lg:w-[180px] shrink-0" />
      </div>
    </header>
  );
}
