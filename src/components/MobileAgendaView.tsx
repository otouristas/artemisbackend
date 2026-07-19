import { useMemo } from "react";
import { eachDayOfInterval, endOfMonth, format, isToday, parseISO, startOfMonth } from "date-fns";
import { el } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";

interface MobileAgendaViewProps {
  currentMonth: Date;
  bookings: Booking[];
  vehicles: Vehicle[];
  onBookingClick: (booking: Booking) => void;
}

interface DayEvents {
  date: Date;
  arrivals: Booking[];
  departures: Booking[];
}

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-success",
  pending: "bg-warning",
  cancelled: "bg-destructive",
};

export function MobileAgendaView({ currentMonth, bookings, vehicles, onBookingClick }: MobileAgendaViewProps) {
  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);

  const days = useMemo<DayEvents[]>(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
      .map((date) => {
        const key = format(date, "yyyy-MM-dd");
        return {
          date,
          arrivals: active.filter((b) => b.check_in === key),
          departures: active.filter((b) => b.check_out === key),
        };
      })
      .filter((d) => d.arrivals.length > 0 || d.departures.length > 0);
  }, [bookings, currentMonth]);

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Καμία άφιξη ή επιστροφή αυτόν τον μήνα.
      </div>
    );
  }

  const renderRow = (b: Booking, kind: "arrival" | "departure") => {
    const vehicle = vehicleMap[b.vehicle_id];
    return (
      <button
        key={`${kind}-${b.id}`}
        onClick={() => onBookingClick(b)}
        className="pressable inset-row w-full gap-3 text-left"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            kind === "arrival" ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
          )}
        >
          {kind === "arrival" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[b.status] ?? "bg-muted-foreground")} />
            <span className="truncate text-sm font-medium">{b.customer_name}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {kind === "arrival" ? "Παραλαβή" : "Επιστροφή"}
            {vehicle ? ` · ${vehicle.name}` : ""}
            {b.plate ? ` · ${b.plate}` : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.date.toISOString()}>
          <h3
            className={cn(
              "sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 -mx-3 mb-2 px-4 py-1.5 text-[13px] font-semibold capitalize glass-header",
              isToday(day.date) ? "text-primary" : "text-muted-foreground",
            )}
          >
            {format(day.date, "EEEE d MMMM", { locale: el })}
            {isToday(day.date) && " · Σήμερα"}
          </h3>
          <div className="inset-group border">
            {day.arrivals.map((b) => renderRow(b, "arrival"))}
            {day.departures.map((b) => renderRow(b, "departure"))}
          </div>
        </section>
      ))}
    </div>
  );
}
