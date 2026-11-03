import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, Car, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";
import { SOURCE_LABELS, STATUS_CHIP, STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { bookingBalance, formatDay, formatEuro, rentalDays, todayKey } from "./clientUtils";

type Filter = "all" | "upcoming" | "past" | "cancelled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Όλες" },
  { id: "upcoming", label: "Επερχόμενες" },
  { id: "past", label: "Ολοκληρωμένες" },
  { id: "cancelled", label: "Ακυρωμένες" },
];

interface BookingHistoryProps {
  bookings: Booking[];
  vehicleMap: Record<string, Vehicle | undefined>;
  onNewBooking: () => void;
}

function VehicleIcon({ vehicle }: { vehicle?: Vehicle }) {
  const Icon = vehicle?.type === "scooter" ? Bike : Car;
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function PaidPill({ b }: { b: Booking }) {
  if (b.status === "cancelled") return <span className="text-xs text-muted-foreground/60">—</span>;
  const due = bookingBalance(b);
  if (due > 0) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning">
        {formatEuro(due)}
      </span>
    );
  }
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      Εξοφλημένη
    </span>
  );
}

export function BookingHistory({ bookings, vehicleMap, onNewBooking }: BookingHistoryProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayKey();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: bookings.length, upcoming: 0, past: 0, cancelled: 0 };
    for (const b of bookings) {
      if (b.status === "cancelled") c.cancelled++;
      else if (b.check_out >= today) c.upcoming++;
      else c.past++;
    }
    return c;
  }, [bookings, today]);

  const rows = useMemo(
    () =>
      bookings.filter((b) => {
        if (filter === "all") return true;
        if (filter === "cancelled") return b.status === "cancelled";
        if (b.status === "cancelled") return false;
        return filter === "upcoming" ? b.check_out >= today : b.check_out < today;
      }),
    [bookings, filter, today],
  );

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-col gap-3 border-b px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Ιστορικό κρατήσεων</h2>
          <p className="text-xs text-muted-foreground">{bookings.length} συνολικά</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="-mx-1 flex min-w-0 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-max items-center gap-0.5 rounded-lg bg-muted p-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors coarse:h-8",
                    "hover:text-foreground",
                    filter === f.id && "bg-card text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.08)]",
                  )}
                >
                  {f.label}
                  <span className="tabular-nums opacity-70">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" variant="outline" className="hidden shrink-0 gap-1 sm:inline-flex" onClick={onNewBooking}>
            <Plus className="h-3.5 w-3.5" />
            Νέα
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {bookings.length === 0 ? "Δεν υπάρχουν κρατήσεις ακόμα." : "Καμία κράτηση σε αυτή την προβολή."}
          </p>
          {bookings.length === 0 && (
            <Button size="sm" className="mt-4 gap-1" onClick={onNewBooking}>
              <Plus className="h-3.5 w-3.5" />
              Νέα κράτηση για τον πελάτη
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="h-9 px-5 font-semibold">Όχημα</th>
                <th className="h-9 px-3 font-semibold">Περίοδος</th>
                <th className="h-9 px-3 font-semibold">Κατάσταση</th>
                <th className="hidden h-9 px-3 font-semibold xl:table-cell">Πηγή</th>
                <th className="h-9 px-3 text-right font-semibold">Σύνολο</th>
                <th className="h-9 px-3 font-semibold">Υπόλοιπο</th>
                <th className="h-9 w-8 pr-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const v = vehicleMap[b.vehicle_id];
                const days = rentalDays(b);
                const upcoming = b.status !== "cancelled" && b.check_in > today;
                const active = b.status !== "cancelled" && b.check_in <= today && b.check_out >= today;
                return (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/booking/${b.id}`)}
                    className={cn(
                      "group/row cursor-pointer border-b border-border/70 transition-colors last:border-b-0 hover:bg-muted/40",
                      b.status === "cancelled" && "text-muted-foreground",
                    )}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <VehicleIcon vehicle={v} />
                        <div className="min-w-0">
                          <p className={cn("truncate font-medium", b.status === "cancelled" && "line-through decoration-muted-foreground/50")}>
                            {v?.name ?? "Όχημα"}
                          </p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{b.plate || v?.plate || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="whitespace-nowrap tabular-nums">
                        {formatDay(b.check_in, "d MMM")} – {formatDay(b.check_out, "d MMM yyyy")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {days} {days === 1 ? "ημέρα" : "ημέρες"}
                        {active && <span className="ml-1.5 font-medium text-primary">· σε εξέλιξη</span>}
                        {upcoming && <span className="ml-1.5 font-medium text-primary">· επερχόμενη</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          STATUS_CHIP[b.status],
                        )}
                      >
                        {STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground xl:table-cell">
                      {b.booking_source ? SOURCE_LABELS[b.booking_source] ?? b.booking_source : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatEuro(Number(b.total_price) || 0)}</td>
                    <td className="px-3 py-2.5">
                      <PaidPill b={b} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover/row:translate-x-0.5" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile list */}
          <ul className="md:hidden">
            {rows.map((b) => {
              const v = vehicleMap[b.vehicle_id];
              const days = rentalDays(b);
              return (
                <li key={b.id} className="border-b border-border/70 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/booking/${b.id}`)}
                    className="pressable flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                  >
                    <VehicleIcon vehicle={v} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-sm font-medium", b.status === "cancelled" && "text-muted-foreground line-through")}>
                          {v?.name ?? "Όχημα"}
                        </p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">{formatEuro(Number(b.total_price) || 0)}</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                        {formatDay(b.check_in, "d MMM")} – {formatDay(b.check_out, "d MMM yyyy")} · {days}{" "}
                        {days === 1 ? "ημέρα" : "ημέρες"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("rounded-full border px-1.5 py-px text-[10px] font-semibold", STATUS_CHIP[b.status])}>
                            {STATUS_LABELS[b.status]}
                          </span>
                          {b.status !== "cancelled" && bookingBalance(b) > 0 && <PaidPill b={b} />}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
