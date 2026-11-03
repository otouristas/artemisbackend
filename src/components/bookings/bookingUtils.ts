import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";

export type BookingStatus = Booking["status"];

export const STATUS_LABEL: Record<string, string> = {
  pending: "Εκκρεμεί",
  confirmed: "Επιβεβαιωμένη",
  cancelled: "Ακυρωμένη",
};

/** Soft pill (list / sheet). */
export const STATUS_PILL: Record<string, string> = {
  confirmed: "bg-success/15 text-success ring-1 ring-inset ring-success/25",
  pending: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/30",
  cancelled: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25",
};

export const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-success",
  pending: "bg-warning",
  cancelled: "bg-destructive",
};

/** Solid timeline bars. */
export const STATUS_BAR: Record<string, string> = {
  confirmed: "bg-success text-success-foreground hover:brightness-110",
  pending: "bg-warning text-warning-foreground hover:brightness-110",
  cancelled: "bg-card text-destructive border border-dashed border-destructive/60 line-through decoration-destructive/40",
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Μετρητά",
  bank: "Τραπεζική κατάθεση",
  iris: "IRIS",
  card: "Κάρτα",
};

export const SOURCE_LABELS: Record<string, string> = {
  phone: "Τηλέφωνο",
  walkin: "Walk-in",
  online: "Online",
  email: "Email",
  website: "Ιστότοπος",
  touristas: "Touristas",
  manual: "Χειροκίνητο",
  api: "API",
};

export const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

/** Plates of a model: the comma string `plate` first, the `plates` array as fallback. */
export function parsePlates(v: Pick<Vehicle, "plate" | "plates">): string[] {
  const fromString = (v.plate ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromString.length) return fromString;
  return (v.plates ?? []).map((s) => s.trim()).filter(Boolean);
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function rentalDays(b: Pick<Booking, "check_in" | "check_out">): number {
  return Math.max(1, differenceInCalendarDays(parseISO(b.check_out), parseISO(b.check_in)));
}

export function money(n: number): string {
  return `${Math.round(n).toLocaleString("el-GR")}€`;
}

export function finance(b: Pick<Booking, "total_price" | "deposit_amount">) {
  const total = Number(b.total_price) || 0;
  const deposit = Number(b.deposit_amount) || 0;
  return { total, deposit, remaining: Math.max(0, total - deposit), paid: total > 0 && deposit >= total };
}

/** True when the day `d` sits between check-in (incl.) and check-out (incl.). */
export function coversDay(b: Pick<Booking, "check_in" | "check_out">, d: Date): boolean {
  const key = isoDay(d);
  return b.check_in <= key && key <= b.check_out;
}

/** Strict night overlap: back-to-back (same-day turnover) bookings do not clash. */
export function overlaps(a: Pick<Booking, "check_in" | "check_out">, b: Pick<Booking, "check_in" | "check_out">) {
  return a.check_in < b.check_out && b.check_in < a.check_out;
}

export interface UnitLane {
  /** 0-based unit index, or -1 for the overflow lane(s). */
  index: number;
  plate: string | null;
  bookings: Booking[];
  overflow: boolean;
}

/**
 * Split a model's bookings over its physical units. A booking whose plate
 * matches a unit goes there; the rest take the first unit that is free for
 * their nights. Active bookings that do not fit open an overflow lane;
 * cancelled ones only show where there is room.
 */
export function allocateUnits(vehicle: Vehicle, bookings: Booking[]): UnitLane[] {
  const plates = parsePlates(vehicle);
  const qty = Math.max(1, vehicle.quantity ?? 1);
  const lanes: UnitLane[] = Array.from({ length: qty }, (_, i) => ({
    index: i,
    plate: plates[i] ?? null,
    bookings: [],
    overflow: false,
  }));
  const fits = (lane: UnitLane, b: Booking) => lane.bookings.every((x) => !overlaps(x, b));

  const sorted = [...bookings].sort((a, b) => a.check_in.localeCompare(b.check_in));
  const active = sorted.filter((b) => b.status !== "cancelled");
  const cancelled = sorted.filter((b) => b.status === "cancelled");
  const rest: Booking[] = [];

  for (const b of active) {
    const plate = b.plate?.trim();
    const lane = plate ? lanes.find((l) => l.plate === plate) : undefined;
    if (lane && fits(lane, b)) lane.bookings.push(b);
    else rest.push(b);
  }
  for (const b of rest) {
    const lane = lanes.find((l) => !l.overflow && fits(l, b));
    if (lane) {
      lane.bookings.push(b);
      continue;
    }
    const over = lanes.find((l) => l.overflow && fits(l, b));
    if (over) over.bookings.push(b);
    else lanes.push({ index: -1, plate: null, bookings: [b], overflow: true });
  }
  for (const b of cancelled) {
    const plate = b.plate?.trim();
    const lane =
      (plate ? lanes.find((l) => l.plate === plate && fits(l, b)) : undefined) ??
      lanes.find((l) => !l.overflow && fits(l, b));
    if (lane) lane.bookings.push(b);
  }
  return lanes;
}

/** Number of units of a model taken on day `d` (night-based, cancelled excluded). */
export function unitsTaken(bookings: Booking[], d: Date): number {
  const key = isoDay(d);
  let n = 0;
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    if (b.check_in <= key && key < b.check_out) n++;
  }
  return n;
}

export function exportBookingsCsv(bookings: Booking[], vehicles: Vehicle[]) {
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
  const headers = [
    "Πελάτης",
    "Τηλέφωνο",
    "Email",
    "Όχημα",
    "Πινακίδα",
    "Check-in",
    "Check-out",
    "Ημέρες",
    "Κατάσταση",
    "Ποσό",
    "Προκαταβολή",
    "Υπόλοιπο",
    "Πηγή",
    "Σχόλια",
    "Πληρωμή",
  ];
  const rows = bookings.map((b) => {
    const f = finance(b);
    return [
      b.customer_name,
      b.customer_phone || "",
      b.customer_email || "",
      vehicleMap.get(b.vehicle_id)?.name || "",
      b.plate || "",
      b.check_in,
      b.check_out,
      String(rentalDays(b)),
      STATUS_LABEL[b.status] || b.status,
      String(f.total),
      String(f.deposit),
      String(f.remaining),
      b.booking_source ? SOURCE_LABELS[b.booking_source] ?? b.booking_source : "",
      b.comments || "",
      b.payment_notes || "",
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bookings_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const todayStart = () => startOfDay(new Date());
