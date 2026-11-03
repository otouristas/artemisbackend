import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { CalendarPlus, KeyRound, LogOut, UserPlus, XCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Booking } from "@/hooks/useBookings";
import type { Client } from "@/hooks/useClients";
import type { Vehicle } from "@/hooks/useVehicles";
import { SOURCE_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { formatDay, formatEuro, todayKey } from "./clientUtils";

interface TimelineEvent {
  key: string;
  at: Date;
  hasTime: boolean;
  icon: LucideIcon;
  tone: string;
  title: string;
  detail?: string;
  bookingId?: string;
}

function safeDate(iso: string): Date | null {
  try {
    const d = parseISO(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function ClientTimeline({
  client,
  bookings,
  vehicleMap,
}: {
  client: Client;
  bookings: Booking[];
  vehicleMap: Record<string, Vehicle | undefined>;
}) {
  const [expanded, setExpanded] = useState(false);

  const events = useMemo(() => {
    const today = todayKey();
    const out: TimelineEvent[] = [];
    const created = safeDate(client.created_at);
    if (created) {
      out.push({
        key: "client",
        at: created,
        hasTime: true,
        icon: UserPlus,
        tone: "bg-muted text-muted-foreground",
        title: "Δημιουργήθηκε το προφίλ πελάτη",
      });
    }
    for (const b of bookings) {
      const vName = vehicleMap[b.vehicle_id]?.name ?? "Όχημα";
      const range = `${formatDay(b.check_in, "d MMM")} – ${formatDay(b.check_out, "d MMM")}`;
      const createdAt = safeDate(b.created_at);
      if (createdAt) {
        const src = b.booking_source ? SOURCE_LABELS[b.booking_source] ?? b.booking_source : null;
        out.push({
          key: `${b.id}-c`,
          at: createdAt,
          hasTime: true,
          icon: b.status === "cancelled" ? XCircle : CalendarPlus,
          tone: b.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          title: b.status === "cancelled" ? `Ακυρωμένη κράτηση · ${vName}` : `Νέα κράτηση · ${vName}`,
          detail: [range, formatEuro(Number(b.total_price) || 0), src].filter(Boolean).join(" · "),
          bookingId: b.id,
        });
      }
      if (b.status === "cancelled") continue;
      const pickup = b.check_in <= today ? safeDate(b.check_in) : null;
      if (pickup) {
        out.push({
          key: `${b.id}-in`,
          at: pickup,
          hasTime: false,
          icon: KeyRound,
          tone: "bg-success/15 text-success",
          title: `Παραλαβή · ${vName}`,
          detail: b.delivery_location || undefined,
          bookingId: b.id,
        });
      }
      const dropoff = b.check_out <= today ? safeDate(b.check_out) : null;
      if (dropoff) {
        out.push({
          key: `${b.id}-out`,
          at: dropoff,
          hasTime: false,
          icon: LogOut,
          tone: "bg-accent/15 text-accent",
          title: `Επιστροφή · ${vName}`,
          bookingId: b.id,
        });
      }
    }
    return out.sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [client.created_at, bookings, vehicleMap]);

  const shown = expanded ? events : events.slice(0, 8);

  const groups = useMemo(() => {
    const g: { label: string; items: TimelineEvent[] }[] = [];
    for (const e of shown) {
      const label = format(e.at, "LLLL yyyy", { locale: el });
      const last = g[g.length - 1];
      if (last && last.label === label) last.items.push(e);
      else g.push({ label, items: [e] });
    }
    return g;
  }, [shown]);

  return (
    <section className="rounded-xl border bg-card">
      <header className="border-b px-4 py-3.5 md:px-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Χρονολόγιο</h2>
        <p className="text-xs text-muted-foreground">Κρατήσεις, παραλαβές και επιστροφές</p>
      </header>
      <div className="px-4 py-4 md:px-5">
        {groups.map((group) => (
          <div key={group.label} className="mb-2 last:mb-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground first-letter:uppercase">
              {group.label}
            </p>
            <ol className="relative">
              {group.items.map((e, i) => {
                const Icon = e.icon;
                const body = (
                  <>
                    <p className="text-sm font-medium leading-5 text-foreground">{e.title}</p>
                    {e.detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.detail}</p>}
                  </>
                );
                return (
                  <li key={e.key} className="relative flex gap-3 pb-4 last:pb-2">
                    {i < group.items.length - 1 && (
                      <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-border" />
                    )}
                    <span className={cn("relative z-[1] mt-0.5 inline-flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full ring-4 ring-card", e.tone)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      {e.bookingId ? (
                        <Link to={`/booking/${e.bookingId}`} className="min-w-0 rounded hover:underline hover:decoration-muted-foreground/40 hover:underline-offset-4">
                          {body}
                        </Link>
                      ) : (
                        <div className="min-w-0">{body}</div>
                      )}
                      <time className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {format(e.at, e.hasTime ? "d MMM, HH:mm" : "d MMM", { locale: el })}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        {events.length > 8 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Λιγότερα" : `Εμφάνιση όλων (${events.length})`}
          </Button>
        )}
      </div>
    </section>
  );
}
