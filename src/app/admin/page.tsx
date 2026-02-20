"use client";

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { Section } from "@/components/Section";
import { PowerBillModal } from "@/components/PowerBillModal";
import { formatDateTime } from "@/lib/format";
import { Eye, CheckCircle, XCircle, Loader2 } from "lucide-react";

type Filter = "not_power_bill" | "power_bill_verified" | "all";

interface Attachment {
  id: string;
  url: string;
  appointment_id: number | null;
  contact_id: number | null;
  source: string;
  attachment_type: string;
  uploaded_at: string;
  setter_name: string | null;
  contact_name: string | null;
  appointment_time: string | null;
}

function PasswordGate({ onAuth }: { onAuth: (key: string) => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch(`/api/admin/attachments?key=${encodeURIComponent(pw)}&filter=not_power_bill`);
    setLoading(false);
    if (res.ok) {
      sessionStorage.setItem("admin_key", pw);
      onAuth(pw);
    } else {
      setError(true);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <Section title="Admin Access" subtitle="Enter password to continue">
          <div className="space-y-3">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {error && (
              <p className="text-xs text-destructive">Invalid password</p>
            )}
            <button
              type="submit"
              disabled={loading || !pw}
              className="w-full rounded-lg bg-card-dark px-4 py-2 text-sm font-medium text-card-dark-foreground transition-colors hover:bg-card-dark/90 disabled:opacity-50"
            >
              {loading ? "Checking..." : "Continue"}
            </button>
          </div>
        </Section>
      </form>
    </div>
  );
}

function formatDateLocal(iso: string | null) {
  if (!iso) return "—";
  return formatDateTime(iso, "America/New_York");
}

export default function AdminAttachmentsPage() {
  const [adminKey, setAdminKey] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_key");
    }
    return null;
  });
  const [filter, setFilter] = useState<Filter>("not_power_bill");
  const [modalUrls, setModalUrls] = useState<string[] | null>(null);
  const [approving, setApproving] = useState<Set<string>>(new Set());

  const apiUrl = adminKey
    ? `/api/admin/attachments?key=${encodeURIComponent(adminKey)}&filter=${filter}`
    : null;

  const { data, error, isLoading } = useSWR(apiUrl, {
    onError: (err: any) => {
      if (err?.status === 401) {
        sessionStorage.removeItem("admin_key");
        setAdminKey(null);
      }
    },
  });

  const attachments: Attachment[] = data?.attachments || [];

  const handleApprove = useCallback(
    async (id: string) => {
      if (!adminKey) return;
      setApproving((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(
          `/api/admin/attachments/${id}?key=${encodeURIComponent(adminKey)}`,
          { method: "PATCH" },
        );
        if (res.ok) {
          mutate(apiUrl);
        } else if (res.status === 401) {
          sessionStorage.removeItem("admin_key");
          setAdminKey(null);
        }
      } finally {
        setApproving((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [adminKey, apiUrl],
  );

  if (!adminKey) {
    return <PasswordGate onAuth={setAdminKey} />;
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "not_power_bill", label: "Rejected" },
    { value: "power_bill_verified", label: "Verified" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Attachment Review
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review AI-rejected images and approve false negatives
        </p>
      </div>

      <div className="inline-flex items-center rounded-lg border border-border bg-card">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`h-9 px-3.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
              filter === f.value
                ? "bg-card-dark text-card-dark-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Failed to load attachments
        </div>
      )}

      {!isLoading && !error && attachments.length === 0 && (
        <Section title="No Results" subtitle={`No ${filter === "all" ? "" : filter.replace(/_/g, " ")} attachments found`}>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nothing to review
          </p>
        </Section>
      )}

      {!isLoading && attachments.length > 0 && (
        <Section
          title={`${attachments.length} Attachment${attachments.length !== 1 ? "s" : ""}`}
          subtitle="Click thumbnail to view full size"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex gap-3 rounded-xl border border-border p-3 transition-all hover:bg-secondary/30"
              >
                {/* Thumbnail */}
                <button
                  onClick={() => setModalUrls([att.url])}
                  className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
                >
                  <img
                    src={att.url}
                    alt="Attachment"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/40">
                    <Eye className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>

                {/* Details */}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="space-y-0.5">
                    {att.contact_name && (
                      <div className="truncate text-sm font-medium text-foreground">
                        {att.contact_name}
                      </div>
                    )}
                    {att.setter_name && (
                      <div className="truncate text-xs text-muted-foreground">
                        Setter: {att.setter_name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatDateLocal(att.appointment_time || att.uploaded_at)}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {att.attachment_type === "not_power_bill" ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-2xs font-medium text-destructive">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                        <button
                          onClick={() => handleApprove(att.id)}
                          disabled={approving.has(att.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                        >
                          {approving.has(att.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          Approve
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
                        <CheckCircle className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {modalUrls && (
        <PowerBillModal urls={modalUrls} onClose={() => setModalUrls(null)} />
      )}
    </div>
  );
}
