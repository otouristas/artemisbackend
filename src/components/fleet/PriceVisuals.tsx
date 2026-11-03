import { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { VehicleRate } from "@/hooks/useVehicleRates";
import { rateForDay } from "@/lib/ratePricing";
import { MONTHS_LONG, MONTHS_SHORT, PRICE_SWATCHES, PRICE_TIERS, euro, isoDay, priceScale } from "./fleetData";

const WEEKDAYS = ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"];

const ratesInYear = (rates: VehicleRate[], year: number) =>
  rates.filter((r) => r.start_date <= `${year}-12-31` && r.end_date >= `${year}-01-01`);

/**
 * Seasonal bands on a one-year strip: each period is a column whose height and
 * colour follow its daily price. Unpriced stretches show as a red baseline.
 */
export function YearPriceStrip({
  rates,
  year,
  onSelect,
  compact,
}: {
  rates: VehicleRate[];
  year: number;
  onSelect?: (rate: VehicleRate) => void;
  compact?: boolean;
}) {
  const yearStart = new Date(year, 0, 1);
  const totalDays = differenceInCalendarDays(new Date(year + 1, 0, 1), yearStart);
  const inYear = useMemo(() => ratesInYear(rates, year), [rates, year]);
  const { min, max, tierOf } = useMemo(() => priceScale(inYear), [inYear]);

  const bands = inYear.map((r) => {
    const start = r.start_date < `${year}-01-01` ? yearStart : parseISO(r.start_date);
    const end = r.end_date > `${year}-12-31` ? new Date(year, 11, 31) : parseISO(r.end_date);
    const from = differenceInCalendarDays(start, yearStart);
    const days = differenceInCalendarDays(end, start) + 1;
    const price = Number(r.daily_rate);
    const t = max > min ? (price - min) / (max - min) : 0.6;
    return { rate: r, left: (from / totalDays) * 100, width: (days / totalDays) * 100, height: 34 + t * 66, tier: tierOf(price) };
  });

  const gaps = useMemo(() => {
    const out: { left: number; width: number }[] = [];
    const ys = new Date(year, 0, 1);
    let open: number | null = null;
    for (let i = 0; i <= totalDays; i++) {
      const priced = i < totalDays && Boolean(rateForDay(inYear, isoDay(addDays(ys, i))));
      if (!priced && open === null && i < totalDays) open = i;
      if ((priced || i === totalDays) && open !== null) {
        out.push({ left: (open / totalDays) * 100, width: ((i - open) / totalDays) * 100 });
        open = null;
      }
    }
    return out;
  }, [inYear, totalDays, year]);

  const now = new Date();
  const todayPct =
    now.getFullYear() === year ? (differenceInCalendarDays(now, yearStart) / totalDays) * 100 : null;

  return (
    <div className="w-full">
      <div className={cn("relative w-full rounded-xl bg-muted/50", compact ? "h-16" : "h-32 sm:h-40")}>
        {/* month gridlines */}
        {MONTHS_SHORT.map((_, m) => {
          const left = (differenceInCalendarDays(new Date(year, m, 1), yearStart) / totalDays) * 100;
          return m === 0 ? null : (
            <span key={m} className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${left}%` }} />
          );
        })}
        {gaps.map((g, i) => (
          <span
            key={i}
            className="absolute bottom-0 h-1.5 rounded-full bg-destructive/60"
            style={{ left: `${g.left}%`, width: `${g.width}%` }}
            title="Χωρίς τιμή"
          />
        ))}
        {bands.map((b) => (
          <button
            key={b.rate.id}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(b.rate)}
            title={`${b.rate.label || "Περίοδος"} · ${format(parseISO(b.rate.start_date), "d MMM", { locale: el })} – ${format(
              parseISO(b.rate.end_date),
              "d MMM",
              { locale: el },
            )} · ${euro(b.rate.daily_rate)}/ημ.`}
            className={cn(
              "absolute bottom-0 flex items-start justify-center overflow-hidden rounded-t-md border-x border-t border-background/60 pt-1 transition-all",
              PRICE_TIERS[b.tier],
              onSelect && "hover:brightness-95 hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            style={{ left: `${b.left}%`, width: `${b.width}%`, height: `${b.height}%` }}
          >
            {!compact && b.width > 4.5 && (
              <span className="px-0.5 text-[10px] font-bold tabular-nums leading-none sm:text-[11px]">
                {euro(b.rate.daily_rate)}
              </span>
            )}
          </button>
        ))}
        {todayPct !== null && (
          <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-primary" style={{ left: `${todayPct}%` }}>
            {!compact && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                Σήμερα
              </span>
            )}
          </span>
        )}
      </div>
      <div className="relative mt-1.5 h-4 w-full">
        {MONTHS_SHORT.map((label, m) => {
          const left = (differenceInCalendarDays(new Date(year, m, 1), yearStart) / totalDays) * 100;
          return (
            <span
              key={label}
              className={cn(
                "absolute text-[10px] font-medium text-muted-foreground",
                compact && m % 2 === 1 && "hidden sm:inline",
              )}
              style={{ left: `calc(${left}% + 2px)` }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function PriceLegend({ rates, year }: { rates: VehicleRate[]; year: number }) {
  const inYear = ratesInYear(rates, year);
  const { min, max } = priceScale(inYear);
  if (!inYear.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        {euro(min)}
        <span className="inline-flex overflow-hidden rounded-full">
          {PRICE_SWATCHES.map((s) => (
            <span key={s} className={cn("h-2.5 w-5", s)} />
          ))}
        </span>
        {euro(max)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full border border-dashed border-destructive/50 bg-destructive/10" />
        Χωρίς τιμή
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-primary" />
        Σήμερα
      </span>
    </div>
  );
}

/** Twelve month calendars, each day coloured by its price (Airbnb host calendar, year view). */
export function PriceYearCalendar({
  rates,
  year,
  pendingStart,
  onDayClick,
}: {
  rates: VehicleRate[];
  year: number;
  pendingStart?: string | null;
  onDayClick: (day: string, rate: VehicleRate | undefined) => void;
}) {
  const inYear = useMemo(() => ratesInYear(rates, year), [rates, year]);
  const { tierOf } = useMemo(() => priceScale(inYear), [inYear]);
  const today = isoDay(new Date());

  return (
    <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {MONTHS_LONG.map((name, m) => {
        const first = new Date(year, m, 1);
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const lead = (getDay(first) + 6) % 7; // Monday first
        const monthRates = inYear.filter(
          (r) => r.start_date <= isoDay(new Date(year, m, daysInMonth)) && r.end_date >= isoDay(first),
        );
        const prices = monthRates.map((r) => Number(r.daily_rate));
        const lo = prices.length ? Math.min(...prices) : null;
        const hi = prices.length ? Math.max(...prices) : null;
        return (
          <section key={name} aria-label={`${name} ${year}`}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{name}</h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {lo === null ? <span className="text-destructive">χωρίς τιμή</span> : lo === hi ? euro(lo) : `${euro(lo)}–${euro(hi!)}`}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="pb-0.5 text-center text-[10px] font-medium text-muted-foreground">
                  {d}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = isoDay(new Date(year, m, i + 1));
                const rate = rateForDay(inYear, day);
                const past = day < today;
                const isPending = pendingStart === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onDayClick(day, rate)}
                    title={rate ? `${rate.label || "Περίοδος"} · ${euro(rate.daily_rate)}/ημ.` : "Χωρίς τιμή · πατήστε για νέα περίοδο"}
                    className={cn(
                      "flex aspect-square min-h-8 flex-col items-center justify-center rounded-md text-center leading-none transition-all",
                      "hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      rate ? PRICE_TIERS[tierOf(Number(rate.daily_rate))] : "border border-dashed border-destructive/40 bg-destructive/5 text-destructive",
                      past && "opacity-40",
                      day === today && "ring-2 ring-primary",
                      isPending && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
                    )}
                  >
                    <span className="text-[10px] font-medium opacity-80">{i + 1}</span>
                    {rate && (
                      <span className="mt-0.5 text-[10px] font-bold tabular-nums">{Number(rate.daily_rate)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
