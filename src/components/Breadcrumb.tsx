import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            {isLast || !seg.href ? (
              <span className={isLast ? "text-foreground font-medium" : ""}>
                {seg.label}
              </span>
            ) : (
              <Link
                href={seg.href}
                className="transition-colors hover:text-foreground"
              >
                {seg.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
