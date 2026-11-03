import { format, isWithinInterval, parseISO, startOfDay } from "date-fns";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";
import type { VehicleBlock } from "@/hooks/useVehicleBlocks";
import type { VehicleRate } from "@/hooks/useVehicleRates";
import { rateForDay } from "@/lib/ratePricing";

export type UnitStatus = "available" | "on_rent" | "blocked";

export interface FleetUnit {
  index: number;
  plate: string | null;
  status: UnitStatus;
}

export interface ModelSummary {
  vehicle: Vehicle;
  units: FleetUnit[];
  plates: string[];
  free: number;
  onRent: number;
  blocked: number;
  total: number;
  activeBlock: VehicleBlock | null;
  todayRate: VehicleRate | undefined;
  nextBooking: Booking | null;
  upcomingCount: number;
}

export const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

/** Plates of a model: the comma string `plate` is the source of truth, `plates` the fallback. */
export function parsePlates(v: Pick<Vehicle, "plate" | "plates">): string[] {
  const fromString = (v.plate ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (fromString.length) return fromString;
  return (v.plates ?? []).map((s) => s.trim()).filter(Boolean);
}

const coversToday = (start: string, end: string, today: Date) =>
  isWithinInterval(today, { start: startOfDay(parseISO(start)), end: startOfDay(parseISO(end)) });

/**
 * Today's state of every unit of a model. A maintenance block covers the whole
 * model; bookings with a plate occupy that unit, bookings without one take the
 * first free units.
 */
export function summarizeModel(
  vehicle: Vehicle,
  bookings: Booking[],
  blocks: VehicleBlock[],
  rates: VehicleRate[],
  today: Date = startOfDay(new Date()),
): ModelSummary {
  const total = vehicle.quantity ?? 1;
  const plates = parsePlates(vehicle);
  const activeBlock =
    blocks.find((b) => b.vehicle_id === vehicle.id && coversToday(b.start_date, b.end_date, today)) ?? null;
  const live = bookings.filter((b) => b.vehicle_id === vehicle.id && b.status !== "cancelled");
  const current = live.filter((b) => coversToday(b.check_in, b.check_out, today));
  const assigned = new Set(current.map((b) => b.plate).filter(Boolean) as string[]);
  let unassigned = current.filter((b) => !b.plate).length;

  const units: FleetUnit[] = [];
  for (let i = 0; i < total; i++) {
    const plate = plates[i] ?? null;
    let status: UnitStatus = "available";
    if (activeBlock) status = "blocked";
    else if (plate && assigned.has(plate)) status = "on_rent";
    else if (unassigned > 0) {
      status = "on_rent";
      unassigned--;
    }
    units.push({ index: i, plate, status });
  }

  const todayIso = isoDay(today);
  const upcoming = live
    .filter((b) => b.check_in > todayIso)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
  const modelRates = rates.filter((r) => r.vehicle_id === vehicle.id);

  return {
    vehicle,
    units,
    plates,
    total,
    free: units.filter((u) => u.status === "available").length,
    onRent: units.filter((u) => u.status === "on_rent").length,
    blocked: units.filter((u) => u.status === "blocked").length,
    activeBlock,
    todayRate: rateForDay(modelRates, todayIso),
    nextBooking: upcoming[0] ?? null,
    upcomingCount: upcoming.length,
  };
}

export const UNIT_STATUS: Record<UnitStatus, { label: string; dot: string; pill: string }> = {
  available: {
    label: "Διαθέσιμο",
    dot: "bg-success",
    pill: "bg-success/15 text-success border-success/25",
  },
  on_rent: {
    label: "Σε ενοικίαση",
    dot: "bg-primary",
    pill: "bg-primary/10 text-primary border-primary/20",
  },
  blocked: {
    label: "Συντήρηση",
    dot: "bg-destructive",
    pill: "bg-destructive/10 text-destructive border-destructive/25",
  },
};

/** Headline state of a model for its card pill. */
export function modelState(s: ModelSummary): { label: string; className: string } {
  if (!s.vehicle.active) return { label: "Ανενεργό", className: "bg-muted text-muted-foreground border-border" };
  if (s.activeBlock) return { label: "Σε συντήρηση", className: UNIT_STATUS.blocked.pill };
  if (s.free === 0) return { label: "Πλήρες σήμερα", className: UNIT_STATUS.on_rent.pill };
  return { label: `${s.free}/${s.total} ελεύθερα`, className: UNIT_STATUS.available.pill };
}

/* ── Price heat scale (Airbnb-style calendar colouring) ─────────────── */

/** Five sun-tinted steps from cheapest to dearest. Static strings so Tailwind keeps them. */
export const PRICE_TIERS = [
  "bg-accent/10 text-foreground",
  "bg-accent/25 text-foreground",
  "bg-accent/45 text-foreground",
  "bg-accent/70 text-accent-foreground",
  "bg-accent text-accent-foreground",
] as const;

export const PRICE_SWATCHES = ["bg-accent/10", "bg-accent/25", "bg-accent/45", "bg-accent/70", "bg-accent"] as const;

export function priceScale(rates: VehicleRate[]) {
  const values = rates.map((r) => Number(r.daily_rate)).filter((n) => n > 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const tierOf = (price: number) => {
    if (max <= min) return 2;
    const t = (price - min) / (max - min);
    return Math.min(PRICE_TIERS.length - 1, Math.floor(t * PRICE_TIERS.length));
  };
  return { min, max, tierOf };
}

export const euro = (n: number | string) => `€${Number(n).toLocaleString("el-GR", { maximumFractionDigits: 2 })}`;

export const MONTHS_SHORT = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];
export const MONTHS_LONG = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
