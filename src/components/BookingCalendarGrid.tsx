import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns";
import { el } from "date-fns/locale";
import { AlertTriangle, Bike, Car, ChevronDown, ChevronsDownUp, ChevronsUpDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";
import type { VehicleBlock } from "@/hooks/useVehicleBlocks";
import {
  STATUS_BAR,
  STATUS_DOT,
  STATUS_LABEL,
  allocateUnits,
  finance,
  initials,
  isoDay,
  money,
  rentalDays,
  todayStart,
  unitsTaken,
  type UnitLane,
} from "@/components/bookings/bookingUtils";

interface BookingCalendarGridProps {
  currentMonth: Date;
  vehicles: Vehicle[];
  bookings: Booking[];
  blocks?: VehicleBlock[];
  onBookingClick: (booking: Booking) => void;
  onCellClick: (vehicleId: string, date: Date) => void;
  onBookingUpdate?: (data: { id: string; check_in: string; check_out: string; plate?: string | null }) => void;
}

const LEFT_COL = 236;
const DAY_MIN = 40;

interface DragState {
  booking: Booking;
  /** Day (within the bar) the user grabbed, relative to check-in. */
  grabOffset: number;
}

interface DropTarget {
  rowKey: string;
  vehicleId: string;
  plate: string | null;
  day: number;
}

export function BookingCalendarGrid({
  currentMonth,
  vehicles,
  bookings,
  blocks = [],
  onBookingClick,
  onCellClick,
  onBookingUpdate,
}: BookingCalendarGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);

  const monthKey = startOfMonth(currentMonth).getTime();
  const monthStart = new Date(monthKey);
  const monthEnd = endOfMonth(monthStart);
  const days = useMemo(
    () => eachDayOfInterval({ start: new Date(monthKey), end: endOfMonth(new Date(monthKey)) }),
    [monthKey],
  );
  const dayCount = days.length;
  const today = todayStart();
  const todayIndex = days.findIndex((d) => isSameDay(d, today));
  const startKey = isoDay(monthStart);
  const endKey = isoDay(monthEnd);

  const gridCols: CSSProperties = {
    gridTemplateColumns: `var(--left-col) repeat(${dayCount}, minmax(${DAY_MIN}px, 1fr))`,
  };

  // Bookings visible in this month, grouped per model and split across units
  const rows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const vb = bookings.filter(
        (b) => b.vehicle_id === vehicle.id && b.check_in <= endKey && b.check_out >= startKey,
      );
      const lanes = allocateUnits(vehicle, vb);
      const vBlocks = blocks.filter(
        (bl) => bl.vehicle_id === vehicle.id && bl.start_date <= endKey && bl.end_date >= startKey,
      );
      const qty = Math.max(1, vehicle.quantity ?? 1);
      const free = days.map((d) => {
        const key = isoDay(d);
        if (vBlocks.some((bl) => bl.start_date <= key && key <= bl.end_date)) return -1;
        return Math.max(0, qty - unitsTaken(vb, d));
      });
      return { vehicle, lanes, blocks: vBlocks, free, qty, count: vb.filter((b) => b.status !== "cancelled").length };
    });
  }, [vehicles, bookings, blocks, days, startKey, endKey]);

  const totalUnits = rows.reduce((s, r) => s + r.qty, 0);
  const allCollapsed = rows.length > 0 && rows.every((r) => collapsed.has(r.vehicle.id));

  // Bring today into view on narrow screens
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayIndex < 0) return;
    const dayWidth = (el.scrollWidth - LEFT_COL) / dayCount;
    const target = LEFT_COL + dayWidth * todayIndex - el.clientWidth / 2;
    if (target > 0) el.scrollLeft = target;
  }, [todayIndex, dayCount, currentMonth]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(rows.map((r) => r.vehicle.id)));

  // ── Drag & drop rescheduling ────────────────────────────
  const dayIndexOf = (iso: string) => differenceInCalendarDays(parseISO(iso), monthStart);

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, booking: Booking) => {
    const track = (e.currentTarget.closest("[data-track]") as HTMLElement | null)?.getBoundingClientRect();
    let grabbed = dayIndexOf(booking.check_in);
    if (track) grabbed = Math.floor(((e.clientX - track.left) / track.width) * dayCount);
    setDrag({ booking, grabOffset: grabbed - dayIndexOf(booking.check_in) });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", booking.id);
  };

  const handleDrop = (target: DropTarget) => {
    setDrop(null);
    if (!drag || !onBookingUpdate) return;
    const { booking, grabOffset } = drag;
    setDrag(null);
    if (target.vehicleId !== booking.vehicle_id) {
      toast.error("Η μετακίνηση γίνεται μόνο μέσα στο ίδιο μοντέλο");
      return;
    }
    const nights = differenceInCalendarDays(parseISO(booking.check_out), parseISO(booking.check_in));
    const newIn = addDays(monthStart, target.day - grabOffset);
    const newOut = addDays(newIn, nights);
    const checkIn = isoDay(newIn);
    const checkOut = isoDay(newOut);
    const plate = target.plate ?? booking.plate;
    if (checkIn === booking.check_in && (plate ?? null) === (booking.plate ?? null)) return;
    onBookingUpdate({ id: booking.id, check_in: checkIn, check_out: checkOut, plate });
  };

  const ghostFor = (rowKey: string) => {
    if (!drag || !drop || drop.rowKey !== rowKey) return null;
    const nights = differenceInCalendarDays(parseISO(drag.booking.check_out), parseISO(drag.booking.check_in));
    const ci = drop.day - drag.grabOffset;
    return barGeometry(ci, ci + nights, dayCount);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div
        ref={scrollRef}
        className="relative max-h-[calc(100dvh-330px)] min-h-[420px] overflow-auto overscroll-contain [--left-col:176px] lg:[--left-col:236px]"
      >
        <div style={{ minWidth: `calc(var(--left-col) + ${dayCount * DAY_MIN}px)` }}>
          {/* ── Sticky date header ── */}
          <div className="sticky top-0 z-30 grid border-b bg-card" style={gridCols}>
            <div className="sticky left-0 z-40 flex items-end justify-between gap-2 border-r bg-card px-3 pb-2 pt-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Στόλος</div>
                <div className="truncate text-xs text-muted-foreground/80">
                  {rows.length} μοντέλα · {totalUnits} μονάδες
                </div>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                title={allCollapsed ? "Ανάπτυξη όλων" : "Σύμπτυξη όλων"}
                aria-label={allCollapsed ? "Ανάπτυξη όλων" : "Σύμπτυξη όλων"}
              >
                {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
              </button>
            </div>
            {days.map((d, i) => {
              const isToday = i === todayIndex;
              const weekend = isWeekend(d);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-end gap-1 border-r border-border/60 pb-2 pt-2.5 last:border-r-0",
                    weekend && "bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      isToday ? "text-primary" : weekend ? "text-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {format(d, "EEEEEE", { locale: el })}
                  </span>
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
                      isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                </div>
              );
            })}
          </div>

          {rows.length === 0 && (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              Κανένα όχημα δεν ταιριάζει στα φίλτρα.
            </div>
          )}

          {rows.map(({ vehicle, lanes, blocks: vBlocks, free, qty, count }) => {
            const isCollapsed = collapsed.has(vehicle.id);
            const Icon = vehicle.type === "scooter" ? Bike : Car;
            const freeToday = todayIndex >= 0 ? free[todayIndex] : null;
            return (
              <div key={vehicle.id} className="border-b last:border-b-0">
                {/* ── Model header with free units per day ── */}
                <div className="grid bg-muted/40" style={gridCols}>
                  <button
                    type="button"
                    onClick={() => toggle(vehicle.id)}
                    className="sticky left-0 z-20 flex h-11 items-center gap-2 border-r bg-muted px-2.5 text-left hover:bg-secondary"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground ring-1 ring-border">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-tight text-foreground">
                        {vehicle.name}
                      </span>
                      <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                        {qty} {qty === 1 ? "μονάδα" : "μονάδες"} · {count} κρατ.
                      </span>
                    </span>
                    {freeToday !== null && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                          freeToday <= 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-success/10 text-success",
                        )}
                        title="Ελεύθερα σήμερα"
                      >
                        {Math.max(0, freeToday)}/{qty}
                      </span>
                    )}
                  </button>
                  {free.map((f, i) => (
                    <div
                      key={i}
                      title={f < 0 ? "Εκτός λειτουργίας" : `${f} από ${qty} ελεύθερα`}
                      className={cn(
                        "flex h-11 items-center justify-center border-r border-border/60 text-[11px] tabular-nums last:border-r-0",
                        isWeekend(days[i]) && "bg-muted/60",
                        i === todayIndex && "bg-primary/[0.07]",
                      )}
                    >
                      <span
                        className={cn(
                          "min-w-[22px] rounded px-1 py-0.5 text-center",
                          f < 0
                            ? "text-muted-foreground"
                            : f === 0
                              ? "bg-destructive/15 font-semibold text-destructive"
                              : f / qty <= 0.25
                                ? "bg-warning/15 font-semibold text-warning"
                                : "text-muted-foreground",
                        )}
                      >
                        {f < 0 ? "—" : f}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Unit rows ── */}
                {!isCollapsed &&
                  lanes.map((lane, laneIdx) => {
                    const rowKey = `${vehicle.id}:${laneIdx}`;
                    const ghost = ghostFor(rowKey);
                    return (
                      <div key={rowKey} className="group/row grid border-t border-border/60" style={gridCols}>
                        <UnitLabel lane={lane} />
                        {days.map((d, i) => (
                          <div
                            key={i}
                            role="button"
                            tabIndex={-1}
                            aria-label={`Νέα κράτηση ${vehicle.name} ${format(d, "d MMM", { locale: el })}`}
                            onClick={() => onCellClick(vehicle.id, d)}
                            onDragOver={(e) => {
                              if (!drag) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (drop?.rowKey !== rowKey || drop.day !== i)
                                setDrop({ rowKey, vehicleId: vehicle.id, plate: lane.plate, day: i });
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDrop({ rowKey, vehicleId: vehicle.id, plate: lane.plate, day: i });
                            }}
                            className={cn(
                              "h-10 cursor-pointer border-r border-border/60 transition-colors last:border-r-0 hover:bg-primary/[0.06]",
                              isWeekend(d) && "bg-muted/50",
                              i === todayIndex && "bg-primary/[0.07]",
                              lane.overflow && "bg-destructive/[0.04]",
                            )}
                            style={{ gridColumn: i + 2, gridRow: 1 }}
                          />
                        ))}

                        {/* Bars layer */}
                        <div
                          data-track
                          className="pointer-events-none relative"
                          style={{ gridColumn: `2 / ${dayCount + 2}`, gridRow: 1 }}
                        >
                          {todayIndex >= 0 && (
                            <div
                              className="absolute inset-y-0 w-px bg-primary/40"
                              style={{ left: `${((todayIndex + 0.5) / dayCount) * 100}%` }}
                            />
                          )}
                          {vBlocks.map((bl) => {
                            const g = blockGeometry(dayIndexOf(bl.start_date), dayIndexOf(bl.end_date), dayCount);
                            if (!g) return null;
                            return (
                              <div
                                key={bl.id}
                                className="absolute inset-y-1 flex items-center gap-1 overflow-hidden rounded-md border border-dashed border-muted-foreground/40 px-2 text-[11px] font-medium text-muted-foreground [background-image:repeating-linear-gradient(135deg,hsl(var(--muted-foreground)/0.14)_0_6px,transparent_6px_12px)]"
                                style={{ left: `calc(${g.left}% + 2px)`, width: `calc(${g.width}% - 4px)` }}
                                title={bl.reason ?? "Εκτός λειτουργίας"}
                              >
                                {laneIdx === 0 && (
                                  <>
                                    <Wrench className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{bl.reason || "Εκτός λειτουργίας"}</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                          {lane.bookings.map((b) => {
                            const g = barGeometry(dayIndexOf(b.check_in), dayIndexOf(b.check_out), dayCount);
                            if (!g) return null;
                            return (
                              <BookingBar
                                key={b.id}
                                booking={b}
                                vehicle={vehicle}
                                geometry={g}
                                dragging={drag?.booking.id === b.id}
                                draggable={!!onBookingUpdate}
                                onClick={() => onBookingClick(b)}
                                onDragStart={(e) => handleDragStart(e, b)}
                                onDragEnd={() => {
                                  setDrag(null);
                                  setDrop(null);
                                }}
                              />
                            );
                          })}
                          {ghost && (
                            <div
                              className="absolute inset-y-1.5 rounded-full border-2 border-dashed border-primary/60 bg-primary/10"
                              style={{ left: `calc(${ghost.left}% + 2px)`, width: `calc(${ghost.width}% - 4px)` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-card px-4 py-2.5 text-xs text-muted-foreground">
        <LegendSwatch className="bg-success" label="Επιβεβαιωμένη" />
        <LegendSwatch className="bg-warning" label="Εκκρεμεί" />
        <LegendSwatch className="border border-dashed border-destructive/60 bg-card" label="Ακυρωμένη" />
        <LegendSwatch
          className="border border-dashed border-muted-foreground/40 [background-image:repeating-linear-gradient(135deg,hsl(var(--muted-foreground)/0.25)_0_3px,transparent_3px_6px)]"
          label="Εκτός λειτουργίας"
        />
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded bg-destructive/15 px-1 text-[10px] font-semibold text-destructive">0</span>
          ελεύθερες μονάδες ανά ημέρα
        </span>
        <span className="ml-auto hidden lg:inline">
          Σύρετε μια κράτηση για αλλαγή ημερομηνιών ή μονάδας · κλικ σε κενό κελί για νέα κράτηση
        </span>
      </div>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────

function UnitLabel({ lane }: { lane: UnitLane }) {
  if (lane.overflow) {
    return (
      <div className="sticky left-0 z-20 flex h-10 items-center gap-2 border-r bg-card pl-9 pr-3 text-destructive" style={{ gridColumn: 1, gridRow: 1 }}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-xs font-semibold">Υπερκράτηση</span>
      </div>
    );
  }
  return (
    <div
      className="sticky left-0 z-20 flex h-10 items-center gap-2 border-r bg-card pl-9 pr-3 group-hover/row:bg-muted"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {lane.index + 1}
      </span>
      {lane.plate ? (
        <span className="truncate whitespace-nowrap font-mono text-[12px] font-medium tracking-wide text-foreground">
          {lane.plate}
        </span>
      ) : (
        <span className="truncate whitespace-nowrap text-xs text-muted-foreground">Χωρίς πινακίδα</span>
      )}
    </div>
  );
}

interface Geometry {
  left: number;
  width: number;
  clipLeft: boolean;
  clipRight: boolean;
}

/** Bar from mid check-in day to mid check-out day (turnover days share a cell). */
function barGeometry(ci: number, co: number, dayCount: number): Geometry | null {
  let start = ci + 0.5;
  let end = co + 0.5;
  if (end - start < 0.6) {
    start = ci + 0.15;
    end = ci + 0.85;
  }
  if (end <= 0 || start >= dayCount) return null;
  const clipLeft = start < 0;
  const clipRight = end > dayCount;
  const s = Math.max(0, start);
  const e = Math.min(dayCount, end);
  return { left: (s / dayCount) * 100, width: ((e - s) / dayCount) * 100, clipLeft, clipRight };
}

function blockGeometry(si: number, ei: number, dayCount: number) {
  const s = Math.max(0, si);
  const e = Math.min(dayCount, ei + 1);
  if (e <= s) return null;
  return { left: (s / dayCount) * 100, width: ((e - s) / dayCount) * 100 };
}

function BookingBar({
  booking,
  vehicle,
  geometry,
  dragging,
  draggable,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  booking: Booking;
  vehicle: Vehicle;
  geometry: Geometry;
  dragging: boolean;
  draggable: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const nights = rentalDays(booking);
  const f = finance(booking);
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={cn(
            "pointer-events-auto absolute inset-y-1.5 z-10 flex items-center gap-1.5 overflow-hidden rounded-full pl-1 pr-2.5 text-left text-[12px] font-semibold shadow-sm transition-[filter,opacity,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            STATUS_BAR[booking.status],
            geometry.clipLeft && "rounded-l-none pl-2",
            geometry.clipRight && "rounded-r-none",
            draggable && "cursor-grab active:cursor-grabbing",
            dragging && "opacity-40",
          )}
          style={{ left: `calc(${geometry.left}% + 2px)`, width: `calc(${geometry.width}% - 4px)` }}
        >
          {!geometry.clipLeft && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/25 text-[9px] font-bold no-underline">
              {initials(booking.customer_name)}
            </span>
          )}
          <span className="min-w-0 truncate">
            {booking.customer_name}
            <span className="font-normal opacity-80"> · {nights} ημ.</span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-64 p-0">
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{booking.customer_name}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[booking.status])} />
              {STATUS_LABEL[booking.status]}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {vehicle.name}
            {booking.plate ? ` · ${booking.plate}` : ""}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium capitalize">
              {format(parseISO(booking.check_in), "EEE d MMM", { locale: el })} →{" "}
              {format(parseISO(booking.check_out), "EEE d MMM", { locale: el })}
            </span>
            <span className="text-muted-foreground">{nights} ημ.</span>
          </div>
          {f.total > 0 && (
            <div className="flex items-center justify-between border-t pt-2 text-xs">
              <span className="font-semibold">{money(f.total)}</span>
              {f.remaining > 0 ? (
                <span className="text-warning">Υπόλοιπο {money(f.remaining)}</span>
              ) : (
                <span className="text-success">Εξοφλημένη</span>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-5 rounded-full", className)} />
      {label}
    </span>
  );
}
