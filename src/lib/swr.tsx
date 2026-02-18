"use client";

import { SWRConfig } from "swr";
import { ReactNode, useSyncExternalStore } from "react";

/* ── Fetcher ── */
export async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ── Global in-flight counter ── */
let inFlight = 0;
let listeners: Array<() => void> = [];
function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function getSnapshot() {
  return inFlight > 0;
}
function bump(delta: number) {
  inFlight = Math.max(0, inFlight + delta);
  listeners.forEach((l) => l());
}

/** Wraps the base fetcher so the global bar can track active requests. */
async function trackedFetcher(url: string) {
  bump(+1);
  try {
    return await fetcher(url);
  } finally {
    bump(-1);
  }
}

/* ── Revalidation bar (thin line at top of viewport) ── */
function RevalidationBar() {
  const active = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden"
    >
      <div
        className={`h-full origin-left transition-all ease-out ${
          active
            ? "animate-revalidate-bar opacity-100"
            : "scale-x-100 opacity-0 duration-300"
        }`}
        style={{ background: "hsl(var(--primary))" }}
      />
    </div>
  );
}

/* ── Provider ── */
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: trackedFetcher,
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
        keepPreviousData: true,
      }}
    >
      <RevalidationBar />
      {children}
    </SWRConfig>
  );
}
