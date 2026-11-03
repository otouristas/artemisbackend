import { differenceInCalendarDays, format, isAfter, isBefore, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { Bike, Car, LayoutGrid } from "lucide-react";
import type { BookingRequest, BookingRequestInsert } from "@/hooks/useBookingRequests";
import type { Vehicle } from "@/hooks/useVehicles";

export type FilterKey = "new" | "all" | "accepted" | "rejected" | "reviewed";
export type VehicleTypeFilter = "all" | "car" | "scooter";

/** Minimal booking shape needed for availability checks. */
export type BookingLite = {
  id: string;
  vehicle_id: string;
  check_in: string;
  check_out: string;
  status: string;
  customer_name: string;
};

export type FormState = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  requested_vehicle: string;
  check_in: string;
  check_out: string;
  pickup_location: string;
  return_location: string;
  child_seat: boolean;
  party_size: string;
  arrival_info: string;
  message: string;
  estimated_total: string;
  source: string;
  admin_notes: string;
  status: BookingRequest["status"];
};

export const emptyForm = (): FormState => ({
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  requested_vehicle: "",
  check_in: "",
  check_out: "",
  pickup_location: "",
  return_location: "",
  child_seat: false,
  party_size: "",
  arrival_info: "",
  message: "",
  estimated_total: "",
  source: "manual",
  admin_notes: "",
  status: "new",
});

export function formFromRequest(r: BookingRequest): FormState {
  return {
    customer_name: r.customer_name,
    customer_email: r.customer_email ?? "",
    customer_phone: r.customer_phone ?? "",
    requested_vehicle: r.requested_vehicle ?? "",
    check_in: r.check_in,
    check_out: r.check_out,
    pickup_location: r.pickup_location ?? "",
    return_location: r.return_location ?? "",
    child_seat: r.child_seat,
    party_size: r.party_size != null ? String(r.party_size) : "",
    arrival_info: r.arrival_info ?? "",
    message: r.message ?? "",
    estimated_total: r.estimated_total != null ? String(r.estimated_total) : "",
    source: r.source || "manual",
    admin_notes: r.admin_notes ?? "",
    status: r.status,
  };
}

export function toInsert(form: FormState): BookingRequestInsert {
  return {
    customer_name: form.customer_name.trim(),
    customer_email: form.customer_email.trim() || null,
    customer_phone: form.customer_phone.trim() || null,
    requested_vehicle: form.requested_vehicle.trim() || null,
    check_in: form.check_in,
    check_out: form.check_out,
    pickup_location: form.pickup_location.trim() || null,
    return_location: form.return_location.trim() || null,
    child_seat: form.child_seat,
    party_size: form.party_size ? Number(form.party_size) : null,
    arrival_info: form.arrival_info.trim() || null,
    message: form.message.trim() || null,
    estimated_total: form.estimated_total ? Number(form.estimated_total) : null,
    source: form.source || "manual",
    admin_notes: form.admin_notes.trim() || null,
    status: form.status,
  };
}

export function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart);
}

export function matchVehicleId(requested: string | null | undefined, vehicles: Vehicle[]): string {
  if (!requested?.trim()) return "";
  const q = requested.trim().toLowerCase().replace(/[-_]/g, " ");
  const exact = vehicles.find((v) => v.name.toLowerCase() === q);
  if (exact) return exact.id;
  const partial = vehicles.find(
    (v) => v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase()),
  );
  return partial?.id ?? "";
}

export function conflictingBookings(
  vehicle: Vehicle,
  checkIn: string,
  checkOut: string,
  bookings: BookingLite[],
): BookingLite[] {
  if (!checkIn || !checkOut) return [];
  const start = parseISO(checkIn);
  const end = parseISO(checkOut);
  return bookings.filter((b) => {
    if (b.vehicle_id !== vehicle.id || b.status === "cancelled") return false;
    return datesOverlap(start, end, parseISO(b.check_in), parseISO(b.check_out));
  });
}

export function freeUnitsForVehicle(
  vehicle: Vehicle,
  checkIn: string,
  checkOut: string,
  bookings: BookingLite[],
): number {
  if (!checkIn || !checkOut) return vehicle.quantity ?? 1;
  const conflicts = conflictingBookings(vehicle, checkIn, checkOut, bookings);
  return Math.max(0, (vehicle.quantity ?? 1) - conflicts.length);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
}

/** "4 – 9 Ιουλ" / "28 Ιουν – 3 Ιουλ" */
export function shortRange(checkIn: string, checkOut: string): string {
  const a = parseISO(checkIn);
  const b = parseISO(checkOut);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${format(a, "d", { locale: el })} – ${format(b, "d MMM", { locale: el })}`;
  }
  return `${format(a, "d MMM", { locale: el })} – ${format(b, "d MMM", { locale: el })}`;
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

function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("69") && phone.length === 10) phone = "30" + phone;
  if (!phone.startsWith("30") && phone.length === 10) phone = "30" + phone;
  return phone;
}

/** WhatsApp link with a short greeting about this request (Greek or English by locale). */
export function requestWhatsAppUrl(r: BookingRequest): string | null {
  if (!r.customer_phone) return null;
  const phone = normalizePhone(r.customer_phone);
  if (!phone) return null;
  const greek = !r.locale || r.locale.toLowerCase().startsWith("el");
  const from = format(parseISO(r.check_in), "dd/MM");
  const to = format(parseISO(r.check_out), "dd/MM");
  const vehicle = r.requested_vehicle ? ` (${r.requested_vehicle})` : "";
  const text = greek
    ? `Γεια σας ${r.customer_name}! Σας ευχαριστούμε για το αίτημά σας στην Artemis Rental Σίφνος για ${from} – ${to}${vehicle}.`
    : `Hello ${r.customer_name}! Thank you for your request with Artemis Rental Sifnos for ${from} – ${to}${vehicle}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export const STATUS_DOT: Record<string, string> = {
  new: "bg-accent",
  reviewed: "bg-primary",
  accepted: "bg-success",
  rejected: "bg-destructive",
};

export const VEHICLE_TYPE_TABS: { key: VehicleTypeFilter; label: string; icon: typeof Car }[] = [
  { key: "all", label: "Όλα", icon: LayoutGrid },
  { key: "car", label: "Αυτοκίνητα", icon: Car },
  { key: "scooter", label: "Scooter", icon: Bike },
];
