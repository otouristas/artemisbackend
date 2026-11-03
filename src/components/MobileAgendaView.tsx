import { useEffect, useMemo, useRef, useState } from "react";
import { eachDayOfInterval, endOfMonth, format, isSameDay, isWeekend, startOfMonth } from "date-fns";
import { el } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, CalendarX2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";
import { STATUS_DOT, STATUS_LABEL, finance, initials, isoDay, money, rentalDays, todayStart } from "@/components/bookings/bookingUtils";

interface MobileAgendaViewProps {
  currentMonth: Date;
  bookings: Booking[];
  vehicles: Vehicle[];
  onBookingClick: (booking: Booking) => void;
}

interface DayEvents {
  date: Date;
  key: string;
  arrivals: Booking[];
  departures: Booking[];
}

export function MobileAgendaView({ currentMonth, bookings, vehicles, onBookingClick }: MobileAgendaViewProps) {
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const stripRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const today = todayStart();
  const monthKey = startOfMonth(currentMonth).getTime();

  const allDays = useMemo<DayEvents[]>(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");
    return eachDayOfInterval({ start: new Date(monthKey), end: endOfMonth(new Date(monthKey)) }).map((date) => {
      const key = isoDay(date);
      return {
        date,
        key,
        arrivals: active.filter((b) => b.check_in === key),
        departures: active.filter((b) => b.check_out === key),
      };
    });
  }, [bookings, monthKey]);

  const eventDays = allDays.filter((d) => d.arrivals.length || d.departures.length);
  const todayKey = isoDay(today);
  const pastDays = eventDays.filter((d) => d.key < todayKey);
  const days = showPast ? eventDays : eventDays.filter((d) => d.key >= todayKey);
  const totals = eventDays.reduce(
    (acc, d) => ({ arrivals: acc.arrivals + d.arrivals.length, departures: acc.departures + d.departures.length }),
    { arrivals: 0, departures: 0 },
  );

  // Centre today in the day strip
  useEffect(() => {
    const strip = stripRef.current;
    const todayEl = strip?.querySelector<HTMLElement>("[data-today='true']");
    if (strip && todayEl) strip.scrollLeft = todayEl.offsetLeft - strip.clientWidth / 2 + todayEl.clientWidth / 2;
  }, [monthKey]);

  const jumpTo = (key: string) => {
    setSelected(key);
    if (key < todayKey) setShowPast(true);
    const target = eventDays.find((d) => d.key >= key) ?? eventDays[eventDays.length - 1];
    if (!target) return;
    requestAnimationFrame(() =>
      document.getElementById(`agenda-${target.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const renderRow = (b: Booking, kind: "arrival" | "departure") => {
    const vehicle = vehicleMap.get(b.vehicle_id);
    const f = finance(b);
    const arrival = kind === "arrival";
    return (
      <button
        key={`${kind}-${b.id}`}
        type="button"
        onClick={() => onBookingClick(b)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-muted/60"
      >
        <span className="relative shrink-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(b.customer_name)}
          </span>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 ring-card",
              arrival ? "bg-success text-success-foreground" : "bg-accent text-accent-foreground",
            )}
          >
            {arrival ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{b.customer_name}</span>
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[b.status])}
              title={STATUS_LABEL[b.status]}
            />
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("font-medium", arrival ? "text-success" : "text-accent")}>
              {arrival ? "Παραλαβή" : "Επιστροφή"}
            </span>
            <span className="truncate">· {vehicle?.name ?? "—"}</span>
          </span>
          {(b.plate || b.delivery_location) && (
            <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {b.plate && (
                <span className="rounded border bg-background px-1 font-mono font-medium text-foreground">{b.plate}</span>
              )}
              {b.delivery_location && <span className="truncate">{b.delivery_location}</span>}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-semibold tabular-nums">{f.total > 0 ? money(f.total) : ""}</span>
          <span className="block text-[11px] text-muted-foreground">{rentalDays(b)} ημ.</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Day strip */}
      <div className="-mx-3 rounded-none border-y bg-card sm:mx-0 sm:rounded-xl sm:border">
        <div ref={stripRef} className="flex gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {allDays.map((d) => {
            const isToday = isSameDay(d.date, today);
            const has = d.arrivals.length > 0 || d.departures.length > 0;
            const isSel = selected === d.key;
            return (
              <button
                key={d.key}
                type="button"
                data-today={isToday}
                onClick={() => jumpTo(d.key)}
                className={cn(
                  "flex w-11 shrink-0 flex-col items-center gap-1 rounded-xl py-1.5 transition-colors",
                  isSel && !isToday && "bg-muted",
                  isWeekend(d.date) && "text-foreground/80",
                )}
              >
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {format(d.date, "EEEEEE", { locale: el })}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    isToday && "bg-primary text-primary-foreground",
                    !isToday && !has && "text-muted-foreground",
                  )}
                >
                  {format(d.date, "d")}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {d.arrivals.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                  {d.departures.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t px-3.5 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="font-semibold text-foreground">{totals.arrivals}</span> παραλαβές
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-semibold text-foreground">{totals.departures}</span> επιστροφές
          </span>
          <span className="ml-auto capitalize">{format(currentMonth, "LLLL", { locale: el })}</span>
        </div>
      </div>

      {!showPast && pastDays.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPast(true)}
          className="w-full rounded-xl border border-dashed py-2.5 text-xs font-medium text-muted-foreground active:bg-muted"
        >
          Εμφάνιση προηγούμενων ημερών ({pastDays.length})
        </button>
      )}

      {days.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-12 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX2 className="h-5 w-5" />
          </span>
          <div className="text-sm font-semibold">
            {eventDays.length === 0 ? "Καμία κίνηση αυτόν τον μήνα" : "Καμία άλλη κίνηση αυτόν τον μήνα"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Δεν υπάρχουν παραλαβές ή επιστροφές.</p>
        </div>
      ) : (
        days.map((day) => {
          const isToday = isSameDay(day.date, today);
          return (
            <section key={day.key} id={`agenda-${day.key}`} className="scroll-mt-[calc(env(safe-area-inset-top)+64px)]">
              <h3 className="sticky top-[calc(env(safe-area-inset-top)+53px)] z-10 -mx-3 mb-2 flex items-baseline gap-2 px-4 py-2 glass-header">
                <span className={cn("text-[15px] font-semibold capitalize", isToday ? "text-primary" : "text-foreground")}>
                  {isToday ? "Σήμερα" : format(day.date, "EEEE", { locale: el })}
                </span>
                <span className="text-[13px] capitalize text-muted-foreground">
                  {format(day.date, "d MMMM", { locale: el })}
                </span>
                <span className="ml-auto text-[11px] font-medium text-muted-foreground">
                  {day.arrivals.length > 0 && <span className="text-success">↓{day.arrivals.length}</span>}
                  {day.arrivals.length > 0 && day.departures.length > 0 && " · "}
                  {day.departures.length > 0 && <span className="text-accent">↑{day.departures.length}</span>}
                </span>
              </h3>
              <div className={cn("overflow-hidden rounded-2xl border bg-card divide-y", isToday && "ring-1 ring-primary/20")}>
                {day.arrivals.map((b) => renderRow(b, "arrival"))}
                {day.departures.map((b) => renderRow(b, "departure"))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
