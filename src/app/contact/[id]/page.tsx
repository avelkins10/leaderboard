"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/Section";
import {
  ArrowLeft,
  DoorOpen,
  Calendar,
  CheckCircle,
  ArrowRightLeft,
  Paperclip,
  Link2,
} from "lucide-react";

const EVENT_CONFIG: Record<
  string,
  { icon: typeof DoorOpen; color: string; label: string }
> = {
  door_knock: {
    icon: DoorOpen,
    color: "bg-secondary text-muted-foreground",
    label: "Door Knock",
  },
  appointment_set: {
    icon: Calendar,
    color: "bg-info/10 text-info",
    label: "Appointment Set",
  },
  disposition: {
    icon: CheckCircle,
    color: "bg-primary/10 text-primary",
    label: "Disposition",
  },
  status_change: {
    icon: ArrowRightLeft,
    color: "bg-warning/10 text-warning",
    label: "Status Change",
  },
  contact_type_change: {
    icon: ArrowRightLeft,
    color: "bg-primary/10 text-primary",
    label: "Type Change",
  },
  attachment: {
    icon: Paperclip,
    color: "bg-secondary text-muted-foreground",
    label: "Attachment",
  },
  deal_match: {
    icon: Link2,
    color: "bg-primary/10 text-primary",
    label: "Deal Match",
  },
};

function eventDescription(event: any): string {
  switch (event.type) {
    case "door_knock":
      return `${event.rep_name || "Rep"} knocked${event.address ? ` at ${event.address}` : ""}`;
    case "appointment_set":
      return `Set by ${event.setter || "setter"} with ${event.closer || "closer"}${event.has_power_bill ? " (power bill)" : ""}`;
    case "disposition":
      return `${event.closer || "Closer"}: ${event.disposition}`;
    case "status_change":
      return `${event.old_status || "?"} → ${event.new_status || "?"} (${event.rep_name || "rep"})`;
    case "contact_type_change":
      return `${event.old_type || "?"} → ${event.new_type || "?"} (${event.closer_name || "closer"})`;
    case "attachment":
      return `${event.attachment_type || "File"} uploaded`;
    case "deal_match":
      return `Matched to QB record ${event.qb_record_id || "?"} (${event.match_method || "?"}, ${event.match_confidence || "?"}%)`;
    default:
      return event.type;
  }
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />
  );
}

export default function ContactPage() {
  const params = useParams();
  const contactId = params.id as string;
  const { data, error, isLoading } = useSWR(`/api/contact/${contactId}`);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Contact #{contactId}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full activity timeline
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {data && !isLoading && (
        <div className="animate-enter">
          <Section
            title="Timeline"
            subtitle={`${data.timeline?.length || 0} events`}
          >
            {!data.timeline || data.timeline.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No events found for this contact
              </p>
            ) : (
              <div className="relative ml-4 border-l border-border pl-6 space-y-4">
                {data.timeline.map((event: any, i: number) => {
                  const config = EVENT_CONFIG[event.type] || {
                    icon: ArrowRightLeft,
                    color: "bg-secondary text-muted-foreground",
                    label: event.type,
                  };
                  const Icon = config.icon;
                  return (
                    <div key={i} className="relative">
                      <span
                        className={`absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full ${config.color}`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/30">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {config.label}
                            </span>
                            <div className="mt-1 text-[13px] text-foreground">
                              {eventDescription(event)}
                            </div>
                          </div>
                          <time className="shrink-0 text-2xs font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                            {event.date
                              ? new Date(event.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  },
                                )
                              : "-"}
                          </time>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
