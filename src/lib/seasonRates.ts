import { addDays, differenceInDays } from "date-fns";

export type Season = "low" | "midLow" | "midHigh" | "peak";

export interface SeasonRates {
  low: number | null;
  midLow: number | null;
  midHigh: number | null;
  peak: number | null;
}

/** Official Artemis Rental rate table — all 4 seasons per vehicle */
const VEHICLE_RATES: Record<string, SeasonRates> = {
  "Skoda Fabia":            { low: 55,  midLow: 65, midHigh: 70, peak: 85  },
  "Fiat Panda":             { low: 45,  midLow: 55, midHigh: 60, peak: 75  },
  "Suzuki Ignis":           { low: 50,  midLow: 65, midHigh: 70, peak: 85  },
  "Peugeot 208":            { low: 50,  midLow: 60, midHigh: 65, peak: 80  },
  "Peugeot 208 Automatic":  { low: 60,  midLow: 75, midHigh: 80, peak: 100 },
  "Nissan Micra":           { low: 45,  midLow: 55, midHigh: 60, peak: 75  },
  "Nissan Micra Automatic": { low: 50,  midLow: 65, midHigh: 70, peak: 85  },
  "Chevrolet Spark":        { low: 40,  midLow: 45, midHigh: 50, peak: 65  },
  "Hyundai i10":            { low: 40,  midLow: 50, midHigh: 55, peak: 70  },
  "Peugeot 301":            { low: 55,  midLow: 65, midHigh: 70, peak: 85  },
  "Citroen C3":             { low: 55,  midLow: 65, midHigh: 70, peak: 85  },
  // Scooters — only available Jun 11 – Sep 10
  "SYM Symphony 125":       { low: null, midLow: null, midHigh: 30, peak: 35 },
  "SYM Symphony 150":       { low: null, midLow: null, midHigh: 30, peak: 35 },
  "SYM Symphony 200":       { low: null, midLow: null, midHigh: 35, peak: 40 },
  "Fiddle 125":             { low: null, midLow: null, midHigh: 30, peak: 35 },
  "JET4 125":               { low: null, midLow: null, midHigh: 30, peak: 35 },
};

export const SEASON_LABELS: Record<Season, string> = {
  low:     "Χαμηλή (Ιαν–10 Μαΐ & Οκτ)",
  midLow:  "Μεσαία Α (11 Μαΐ–10 Ιουν & 11–30 Σεπ)",
  midHigh: "Μεσαία Β (11 Ιουν–10 Ιουλ)",
  peak:    "Peak (11 Ιουλ–10 Σεπ)",
};

export function getSeason(date: Date): Season {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 7 && d >= 11) || m === 8 || (m === 9 && d <= 10)) return "peak";
  if ((m === 6 && d >= 11) || (m === 7 && d <= 10)) return "midHigh";
  if ((m === 5 && d >= 11) || (m === 6 && d <= 10) || (m === 9 && d >= 11)) return "midLow";
  return "low";
}

export interface PriceSegment {
  season: Season;
  label: string;
  days: number;
  rate: number;
  subtotal: number;
}

export interface PriceBreakdown {
  totalDays: number;
  segments: PriceSegment[];
  baseTotal: number;
  available: boolean;
}

export function calculateSeasonalPrice(
  vehicleName: string,
  checkIn: Date,
  checkOut: Date,
): PriceBreakdown | null {
  const rates = VEHICLE_RATES[vehicleName];
  if (!rates) return null;

  const totalDays = differenceInDays(checkOut, checkIn);
  if (totalDays <= 0) return null;

  const dayData: { season: Season; rate: number | null }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const day = addDays(checkIn, i);
    const season = getSeason(day);
    dayData.push({ season, rate: rates[season] });
  }

  if (dayData.some((d) => d.rate === null)) {
    return { totalDays, segments: [], baseTotal: 0, available: false };
  }

  const segments: PriceSegment[] = [];
  let cur = dayData[0];
  let count = 1;
  for (let i = 1; i < dayData.length; i++) {
    if (dayData[i].season === cur.season) {
      count++;
    } else {
      segments.push({ season: cur.season, label: SEASON_LABELS[cur.season], days: count, rate: cur.rate as number, subtotal: (cur.rate as number) * count });
      cur = dayData[i];
      count = 1;
    }
  }
  segments.push({ season: cur.season, label: SEASON_LABELS[cur.season], days: count, rate: cur.rate as number, subtotal: (cur.rate as number) * count });

  const baseTotal = segments.reduce((s, seg) => s + seg.subtotal, 0);
  return { totalDays, segments, baseTotal, available: true };
}
