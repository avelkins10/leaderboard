"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface PowerBillModalProps {
  urls: string[];
  onClose: () => void;
}

function isPdf(url: string) {
  return /\.pdf($|\?)/i.test(url);
}

export function PowerBillModal({ urls, onClose }: PowerBillModalProps) {
  const [index, setIndex] = useState(0);
  const multi = urls.length > 1;
  const url = urls[index];

  const prev = useCallback(
    () => setIndex((i) => (i > 0 ? i - 1 : urls.length - 1)),
    [urls.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i < urls.length - 1 ? i + 1 : 0)),
    [urls.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (multi && e.key === "ArrowLeft") prev();
      if (multi && e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, multi, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[90vh] max-w-3xl flex-col rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">
            Power Bill{multi ? ` (${index + 1}/${urls.length})` : ""}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open original
            </a>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isPdf(url) ? (
            <iframe
              src={url}
              className="h-[70vh] w-full rounded-lg border border-border"
              title="Power Bill PDF"
            />
          ) : (
            <img
              src={url}
              alt="Power Bill"
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          )}
        </div>

        {/* Navigation */}
        {multi && (
          <div className="flex items-center justify-center gap-4 border-t border-border px-4 py-3">
            <button
              onClick={prev}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {index + 1} / {urls.length}
            </span>
            <button
              onClick={next}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
