import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { toast } from "sonner";
import type { Booking } from "@/hooks/useBookings";

export interface ClientStats {
  /** Non-cancelled bookings */
  count: number;
  cancelled: number;
  ltv: number;
  balance: number;
  rentalDays: number;
  firstRental: string | null;
  /** Most recent check_out of a rental that has already started */
  lastRental: string | null;
  /** Earliest check_in that is today or later */
  nextRental: string | null;
}

export const EMPTY_STATS: ClientStats = {
  count: 0,
  cancelled: 0,
  ltv: 0,
  balance: 0,
  rentalDays: 0,
  firstRental: null,
  lastRental: null,
  nextRental: null,
};

export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function bookingBalance(b: Pick<Booking, "total_price" | "deposit_amount">): number {
  return Math.max((Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0), 0);
}

export function rentalDays(b: Pick<Booking, "check_in" | "check_out">): number {
  try {
    return Math.max(differenceInCalendarDays(parseISO(b.check_out), parseISO(b.check_in)), 1);
  } catch {
    return 1;
  }
}

export function accumulateStats(cur: ClientStats, b: Booking, today: string): ClientStats {
  if (b.status === "cancelled") return { ...cur, cancelled: cur.cancelled + 1 };
  const total = Number(b.total_price) || 0;
  const next = { ...cur };
  next.count += 1;
  next.ltv += total;
  next.balance += bookingBalance(b);
  next.rentalDays += rentalDays(b);
  if (!next.firstRental || b.check_in < next.firstRental) next.firstRental = b.check_in;
  if (b.check_in <= today) {
    if (!next.lastRental || b.check_out > next.lastRental) next.lastRental = b.check_out;
  }
  if (b.check_in >= today) {
    if (!next.nextRental || b.check_in < next.nextRental) next.nextRental = b.check_in;
  }
  return next;
}

export function computeStatsByClient(bookings: Booking[]): Map<string, ClientStats> {
  const today = todayKey();
  const map = new Map<string, ClientStats>();
  for (const b of bookings) {
    if (!b.client_id) continue;
    map.set(b.client_id, accumulateStats(map.get(b.client_id) ?? EMPTY_STATS, b, today));
  }
  return map;
}

export function computeStats(bookings: Booking[]): ClientStats {
  const today = todayKey();
  return bookings.reduce((acc, b) => accumulateStats(acc, b, today), EMPTY_STATS);
}

const euro = new Intl.NumberFormat("el-GR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEuro(n: number): string {
  return euro.format(Math.round(n));
}

export function formatDay(iso: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern, { locale: el });
  } catch {
    return "—";
  }
}

export const LANGUAGE_LABELS: Record<string, string> = {
  el: "Ελληνικά",
  en: "Αγγλικά",
  de: "Γερμανικά",
  fr: "Γαλλικά",
  it: "Ιταλικά",
  es: "Ισπανικά",
  nl: "Ολλανδικά",
  pt: "Πορτογαλικά",
  ru: "Ρωσικά",
  pl: "Πολωνικά",
  sv: "Σουηδικά",
  tr: "Τουρκικά",
  he: "Εβραϊκά",
  zh: "Κινεζικά",
};

export function normalizeLanguage(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toLowerCase().slice(0, 2);
  return c || null;
}

export function languageLabel(code: string | null | undefined): string {
  const c = normalizeLanguage(code);
  if (!c) return "—";
  return LANGUAGE_LABELS[c] ?? c.toUpperCase();
}

export function whatsappLink(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("69")) digits = "30" + digits;
  if (!digits.startsWith("30") && digits.length === 10) digits = "30" + digits;
  return `https://wa.me/${digits}`;
}

export function phoneKey(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

const AVATAR_TONES = [
  "bg-primary/10 text-primary",
  "bg-accent/15 text-accent",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-destructive/10 text-destructive",
  "bg-secondary text-secondary-foreground",
];

export function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

export async function copyText(text: string, label = "Αντιγράφηκε") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label, { description: text });
  } catch {
    toast.error("Η αντιγραφή απέτυχε");
  }
}

export type SortKey = "name" | "bookings" | "ltv" | "balance" | "last";
export type SortDir = "asc" | "desc";
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export const SORT_LABELS: Record<SortKey, string> = {
  name: "Όνομα",
  bookings: "Κρατήσεις",
  ltv: "Συνολική αξία",
  balance: "Υπόλοιπο",
  last: "Τελευταία ενοικίαση",
};
