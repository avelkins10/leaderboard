'use client';
import { useState, ReactNode } from 'react';
import { Info } from 'lucide-react';

export function Tooltip({ text, children }: { text: string; children?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children || <Info className="h-3 w-3 cursor-help text-muted-foreground/40 transition-colors hover:text-muted-foreground" />}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 animate-pop rounded-lg border border-border bg-card px-3 py-2 text-center text-2xs leading-relaxed text-foreground shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}
