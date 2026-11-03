import { addDays, differenceInDays, format } from "date-fns";
import type { VehicleRate } from "@/hooks/useVehicleRates";

export interface RateSegment {
  label: string;
  days: number;
  rate: number;
  subtotal: number;
}

export interface RateBreakdown {
  totalDays: number;
  segments: RateSegment[];
  baseTotal: number;
  /** False when at least one night has no rate period. */
  available: boolean;
}

/** The rate period covering a calendar day, or undefined. */
export function rateForDay(rates: VehicleRate[], day: string) {
  return rates.find((r) => r.start_date <= day && day <= r.end_date);
}

/**
 * Price a rental from the model's rate periods. Charged per night, like the
 * seasonal table it replaces: check-in 10 Jun, check-out 14 Jun is 4 days.
 */
export function calculateFromRates(
  rates: VehicleRate[],
  checkIn: Date,
  checkOut: Date,
): RateBreakdown | null {
  const totalDays = differenceInDays(checkOut, checkIn);
  if (totalDays <= 0) return null;

  const segments: RateSegment[] = [];
  let available = true;
  let current: { id: string; segment: RateSegment } | null = null;

  for (let i = 0; i < totalDays; i++) {
    const period = rateForDay(rates, format(addDays(checkIn, i), "yyyy-MM-dd"));
    if (!period) {
      available = false;
      current = null;
      continue;
    }
    const rate = Number(period.daily_rate);
    if (current && current.id === period.id) {
      current.segment.days += 1;
      current.segment.subtotal += rate;
    } else {
      const segment = { label: period.label || "Περίοδος", days: 1, rate, subtotal: rate };
      segments.push(segment);
      current = { id: period.id, segment };
    }
  }

  if (!available) return { totalDays, segments: [], baseTotal: 0, available: false };
  const baseTotal = segments.reduce((sum, s) => sum + s.subtotal, 0);
  return { totalDays, segments, baseTotal, available: true };
}
