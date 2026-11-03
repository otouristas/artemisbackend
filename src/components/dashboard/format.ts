import type { Booking } from "@/hooks/useBookings";

const euro = new Intl.NumberFormat("el-GR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** "1.234 €" in Greek formatting, no decimals. */
export function formatEuro(value: number): string {
  return euro.format(Math.round(value || 0));
}

/** Compact euro for chart axes: "1,2 χιλ. €" → we keep it short as "1,2k €". */
export function formatEuroCompact(value: number): string {
  const v = Math.round(value || 0);
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return `${k.toLocaleString("el-GR", { maximumFractionDigits: k >= 10 ? 0 : 1 })}k €`;
  }
  return `${v} €`;
}

export function bookingTotal(b: Pick<Booking, "total_price">): number {
  return Number(b.total_price) || 0;
}

export function bookingPaid(b: Pick<Booking, "deposit_amount">): number {
  return Number(b.deposit_amount) || 0;
}

export function bookingBalance(b: Pick<Booking, "total_price" | "deposit_amount">): number {
  return bookingTotal(b) - bookingPaid(b);
}

/** Percentage change from `prev` to `curr`; null when there is no baseline. */
export function percentDelta(curr: number, prev: number): number | null {
  if (!prev) return curr ? null : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export type Tone = "primary" | "success" | "accent" | "warning" | "destructive" | "muted";

export const TONE_SOFT: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  accent: "bg-accent/10 text-accent",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export const TONE_DOT: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  accent: "bg-accent",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/50",
};
