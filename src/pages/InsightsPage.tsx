import { useMemo, useState } from "react";
import {
  parseISO,
  differenceInDays,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  getDay,
} from "date-fns";
import { el } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CalendarCheck,
  Users,
  Percent,
  BedDouble,
  Car,
  PieChart as PieIcon,
  CalendarClock,
  CalendarDays,
  LineChart as LineIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { useIsMobile } from "@/hooks/use-mobile";
import { SOURCE_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import {
  DashboardContainer,
  DashboardHeader,
  EmptyState,
  LegendDot,
  Panel,
  StatTile,
} from "@/components/dashboard/primitives";
import { formatEuro, formatEuroCompact, percentDelta } from "@/components/dashboard/format";

const SERIES_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
];

const SEASONS = ["Χαμηλή", "Μεταβατική", "Μεσαία", "Αιχμή"] as const;
const SEASON_HINT: Record<(typeof SEASONS)[number], string> = {
  Χαμηλή: "Οκτ – 10 Μαΐ",
  Μεταβατική: "11 Μαΐ – 10 Ιουν · 11–30 Σεπ",
  Μεσαία: "11 Ιουν – 10 Ιουλ",
  Αιχμή: "11 Ιουλ – 10 Σεπ",
};

function seasonForDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // Artemis rates: low / shoulder / mid / peak
  if (m === 10 || m <= 4 || (m === 5 && day <= 10)) return "Χαμηλή";
  if ((m === 5 && day >= 11) || (m === 6 && day <= 10) || (m === 9 && day >= 11)) return "Μεταβατική";
  if ((m === 6 && day >= 11) || (m === 7 && day <= 10)) return "Μεσαία";
  if ((m === 7 && day >= 11) || m === 8 || (m === 9 && day <= 10)) return "Αιχμή";
  return "Χαμηλή";
}

function bookingsInMonth(bookings: Booking[], month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  return bookings.filter((b) => {
    const checkIn = parseISO(b.check_in);
    const checkOut = parseISO(b.check_out);
    return (
      b.status !== "cancelled" &&
      (isWithinInterval(checkIn, { start: monthStart, end: monthEnd }) ||
        isWithinInterval(checkOut, { start: monthStart, end: monthEnd }) ||
        (checkIn <= monthStart && checkOut >= monthEnd))
    );
  });
}

function computeStats(monthBookings: Booking[], vehicleCount: number, month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const totalRevenue = monthBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
  const totalDays = monthBookings.reduce((sum, b) => {
    const days = differenceInDays(parseISO(b.check_out), parseISO(b.check_in));
    return sum + Math.max(days, 1);
  }, 0);
  const uniqueCustomers = new Set(monthBookings.map((b) => b.customer_name.toLowerCase())).size;
  const avgStay = monthBookings.length ? Math.round((totalDays / monthBookings.length) * 10) / 10 : 0;
  const daysInMonth = endOfMonth(month).getDate();
  const occupancy = vehicleCount > 0 ? Math.round((totalDays / (vehicleCount * daysInMonth)) * 100) : 0;
  const arrivals = monthBookings.filter((b) => {
    const ci = parseISO(b.check_in);
    return ci >= monthStart && ci <= monthEnd;
  }).length;
  return { totalRevenue, occupancy, arrivals, avgStay, uniqueCustomers, totalDays };
}

const trendConfig = {
  revenue: { label: "Έσοδα", color: "hsl(var(--primary))" },
  occupancy: { label: "Πληρότητα", color: "hsl(var(--accent))" },
} satisfies ChartConfig;

const simpleConfig = {
  value: { label: "Κρατήσεις", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const WEEKDAYS = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];

export default function InsightsPage() {
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: bookings = [], isLoading: loadingB } = useBookings();
  const { data: vehicles = [], isLoading: loadingV } = useVehicles();
  const isLoading = loadingB || loadingV;

  const monthBookings = useMemo(() => bookingsInMonth(bookings, currentMonth), [bookings, currentMonth]);

  const stats = useMemo(
    () => computeStats(monthBookings, vehicles.length, currentMonth),
    [monthBookings, vehicles.length, currentMonth],
  );

  const prevStats = useMemo(() => {
    const prev = subMonths(currentMonth, 1);
    return computeStats(bookingsInMonth(bookings, prev), vehicles.length, prev);
  }, [bookings, vehicles.length, currentMonth]);

  // 12-month trend ending at the selected month
  const trend = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = subMonths(currentMonth, 11 - i);
        const s = computeStats(bookingsInMonth(bookings, m), vehicles.length, m);
        return {
          key: format(m, "yyyy-MM"),
          date: m,
          label: format(m, "LLL", { locale: el }).replace(".", ""),
          revenue: s.totalRevenue,
          occupancy: s.occupancy,
          arrivals: s.arrivals,
          avgStay: s.avgStay,
          customers: s.uniqueCustomers,
          selected: i === 11,
        };
      }),
    [bookings, vehicles.length, currentMonth],
  );
  const last6 = trend.slice(-6);

  const vehicleTypeData = useMemo(() => {
    const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
    const typeCount: Record<string, number> = {};
    monthBookings.forEach((b) => {
      const v = vehicleMap[b.vehicle_id];
      if (v) {
        const baseName = v.name.replace(/ #\d+$/, "");
        typeCount[baseName] = (typeCount[baseName] || 0) + 1;
      }
    });
    return Object.entries(typeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [monthBookings, vehicles]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthBookings.forEach((b) => {
      const s = b.booking_source || "phone";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, value]) => ({
        name: SOURCE_LABELS[key] || key,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthBookings]);

  const durationData = useMemo(() => {
    const buckets = [
      { name: "1–2", min: 0, max: 2, value: 0 },
      { name: "3–4", min: 3, max: 4, value: 0 },
      { name: "5–7", min: 5, max: 7, value: 0 },
      { name: "8–14", min: 8, max: 14, value: 0 },
      { name: "15+", min: 15, max: Infinity, value: 0 },
    ];
    monthBookings.forEach((b) => {
      const d = Math.max(differenceInDays(parseISO(b.check_out), parseISO(b.check_in)), 1);
      const bucket = buckets.find((x) => d >= x.min && d <= x.max);
      if (bucket) bucket.value += 1;
    });
    return buckets.map(({ name, value }) => ({ name, value }));
  }, [monthBookings]);

  const weekdayData = useMemo(() => {
    const counts = Array(7).fill(0) as number[];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    monthBookings.forEach((b) => {
      const ci = parseISO(b.check_in);
      if (ci >= monthStart && ci <= monthEnd) counts[(getDay(ci) + 6) % 7] += 1;
    });
    return WEEKDAYS.map((name, i) => ({ name, value: counts[i] }));
  }, [monthBookings, currentMonth]);

  const season = seasonForDate(currentMonth);
  const isCurrent = isSameMonth(currentMonth, new Date());
  const sourceTotal = sourceData.reduce((s, d) => s + d.value, 0);
  const topVehicle = vehicleTypeData[0]?.value || 0;

  if (isLoading) {
    return (
      <DashboardContainer>
        <Skeleton className="mb-2 h-4 w-40" />
        <Skeleton className="mb-8 h-10 w-56" />
        <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-[140px] rounded-xl", i === 4 && "col-span-2 lg:col-span-1")} />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-[380px] rounded-xl xl:col-span-2" />
          <Skeleton className="h-[380px] rounded-xl" />
        </div>
      </DashboardContainer>
    );
  }

  const empty = monthBookings.length === 0;

  return (
    <DashboardContainer>
      <DashboardHeader
        eyebrow={`Περίοδος: ${season}`}
        title="Στατιστικά"
        description={
          empty
            ? "Χωρίς κρατήσεις για αυτόν τον μήνα."
            : `${monthBookings.length} ${monthBookings.length === 1 ? "κράτηση" : "κρατήσεις"} · ${stats.totalDays} ημέρες ενοικίασης · ${vehicles.length} οχήματα στόλου`
        }
        actions={
          <>
            {!isCurrent && (
              <Button variant="ghost" className="h-10 rounded-full px-4 text-[13px]" onClick={() => setCurrentMonth(new Date())}>
                Τρέχων μήνας
              </Button>
            )}
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full coarse:h-10 coarse:w-10"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                aria-label="Προηγούμενος μήνας"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[128px] text-center text-sm font-semibold capitalize">
                {format(currentMonth, "LLLL yyyy", { locale: el })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full coarse:h-10 coarse:w-10"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                aria-label="Επόμενος μήνας"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        }
      >
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {SEASONS.map((s) => (
            <div
              key={s}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium",
                s === season ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              <span className="font-semibold">{s}</span>
              <span className={cn("hidden sm:inline", s === season ? "text-primary-foreground/70" : "text-muted-foreground/80")}>
                {SEASON_HINT[s]}
              </span>
            </div>
          ))}
        </div>
      </DashboardHeader>

      {/* KPI tiles with month-over-month deltas */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <StatTile
          label="Έσοδα"
          icon={TrendingUp}
          value={formatEuro(stats.totalRevenue)}
          delta={percentDelta(stats.totalRevenue, prevStats.totalRevenue)}
          hint="έναντι προηγ. μήνα"
          spark={last6.map((t) => t.revenue)}
        />
        <StatTile
          label="Πληρότητα"
          icon={Percent}
          tone="accent"
          value={`${stats.occupancy}%`}
          delta={stats.occupancy - prevStats.occupancy}
          deltaSuffix=" μ."
          hint={`${stats.totalDays} ημέρες ενοικίασης`}
          spark={last6.map((t) => t.occupancy)}
          sparkColor="hsl(var(--accent))"
        />
        <StatTile
          label="Αφίξεις"
          icon={CalendarCheck}
          tone="success"
          value={stats.arrivals}
          delta={percentDelta(stats.arrivals, prevStats.arrivals)}
          hint="νέες παραλαβές τον μήνα"
          spark={last6.map((t) => t.arrivals)}
          sparkColor="hsl(var(--success))"
        />
        <StatTile
          label="Μέση διαμονή"
          icon={BedDouble}
          tone="warning"
          value={`${stats.avgStay} ημ.`}
          delta={percentDelta(stats.avgStay, prevStats.avgStay)}
          hint="ανά κράτηση"
          spark={last6.map((t) => t.avgStay)}
          sparkColor="hsl(var(--warning))"
        />
        <div className="col-span-2 lg:col-span-1">
          <StatTile
            label="Πελάτες"
            icon={Users}
            tone="muted"
            value={stats.uniqueCustomers}
            delta={percentDelta(stats.uniqueCustomers, prevStats.uniqueCustomers)}
            hint="μοναδικοί πελάτες"
            spark={last6.map((t) => t.customers)}
            sparkColor="hsl(var(--muted-foreground))"
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {/* 12-month trend */}
        <Panel
          className="lg:col-span-2"
          icon={LineIcon}
          title="Έσοδα & πληρότητα · 12 μήνες"
          description="Πατήστε μια στήλη για να δείτε εκείνον τον μήνα"
          action={
            <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
              <span className="flex items-center gap-1.5">
                <LegendDot color="hsl(var(--primary))" /> Έσοδα
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded bg-accent" /> Πληρότητα
              </span>
            </div>
          }
        >
          <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full md:h-[300px]">
            <ComposedChart
              data={trend}
              margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
              onClick={(state) => {
                const idx = state?.activeTooltipIndex;
                if (typeof idx === "number" && trend[idx]) setCurrentMonth(trend[idx].date);
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={isMobile ? 1 : 0} tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="rev"
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => formatEuroCompact(v)}
              />
              <YAxis
                yAxisId="occ"
                orientation="right"
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof trend)[number];
                  return (
                    <div className="min-w-[170px] rounded-lg border border-border bg-popover px-3 py-2.5 text-xs shadow-md">
                      <p className="mb-1.5 font-semibold capitalize text-foreground">
                        {format(p.date, "LLLL yyyy", { locale: el })}
                      </p>
                      <Row color="hsl(var(--primary))" label="Έσοδα" value={formatEuro(p.revenue)} />
                      <Row color="hsl(var(--accent))" label="Πληρότητα" value={`${p.occupancy}%`} />
                      <Row color="hsl(var(--success))" label="Αφίξεις" value={`${p.arrivals}`} />
                    </div>
                  );
                }}
              />
              <Bar yAxisId="rev" dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={40} className="cursor-pointer">
                {trend.map((t) => (
                  <Cell key={t.key} fill="hsl(var(--primary))" fillOpacity={t.selected ? 1 : 0.35} />
                ))}
              </Bar>
              <Line
                yAxisId="occ"
                type="monotone"
                dataKey="occupancy"
                stroke="hsl(var(--accent))"
                strokeWidth={2.25}
                dot={{ r: 3, fill: "hsl(var(--card))", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ChartContainer>
        </Panel>

        {/* Sources */}
        <Panel icon={PieIcon} title="Πηγές" description="Από πού ήρθαν οι κρατήσεις">
          {sourceData.length === 0 ? (
            <EmptyState title="Δεν υπάρχουν δεδομένα πηγών." className="py-16" />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col 2xl:flex-row">
              <div className="relative h-[180px] w-[180px] shrink-0">
                <ChartContainer config={simpleConfig} className="aspect-square h-full w-full">
                  <PieChart>
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0];
                        return (
                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                            <span className="font-semibold text-foreground">{p.name}</span>
                            <span className="ml-2 tabular-nums text-muted-foreground">{p.value as number}</span>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-foreground">{sourceTotal}</span>
                  <span className="text-[11px] text-muted-foreground">κρατήσεις</span>
                </div>
              </div>
              <ul className="w-full min-w-0 space-y-2">
                {sourceData.map((s, i) => {
                  const pct = sourceTotal ? Math.round((s.value / sourceTotal) * 100) : 0;
                  return (
                    <li key={s.name} className="flex items-center gap-2.5 text-[13px]">
                      <LegendDot color={SERIES_COLORS[i % SERIES_COLORS.length]} />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.name}</span>
                      <span className="tabular-nums text-muted-foreground">{s.value}</span>
                      <span className="w-10 text-right font-semibold tabular-nums text-foreground">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>

        {/* Vehicles ranking */}
        <Panel icon={Car} title="Οχήματα" description="Κρατήσεις ανά μοντέλο τον μήνα">
          {empty || vehicleTypeData.length === 0 ? (
            <EmptyState
              title="Χωρίς δεδομένα αυτόν τον μήνα"
              description="Προσθέστε κρατήσεις για να δείτε κατανομή οχημάτων και πηγές."
              className="py-12"
            />
          ) : (
            <ol className="space-y-3">
              {vehicleTypeData.map((v, i) => (
                <li key={v.name}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="truncate font-medium text-foreground">{v.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">{v.value}</span>
                  </div>
                  <div className="ml-6 mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/60")}
                      style={{ width: `${topVehicle ? Math.max((v.value / topVehicle) * 100, 4) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* Rental duration */}
        <Panel icon={CalendarClock} title="Διάρκεια ενοικίασης" description="Κρατήσεις ανά πλήθος ημερών">
          {empty ? (
            <EmptyState title="Χωρίς δεδομένα αυτόν τον μήνα" className="py-12" />
          ) : (
            <SmallBars data={durationData} suffix=" ημ." />
          )}
        </Panel>

        {/* Arrival weekdays */}
        <Panel icon={CalendarDays} title="Ημέρες άφιξης" description="Παραλαβές ανά ημέρα εβδομάδας">
          {stats.arrivals === 0 ? (
            <EmptyState title="Χωρίς αφίξεις αυτόν τον μήνα" className="py-12" />
          ) : (
            <SmallBars data={weekdayData} color="hsl(var(--success))" />
          )}
        </Panel>
      </div>
    </DashboardContainer>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5 text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <LegendDot color={color} className="h-2 w-2" />
        {label}
      </span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function SmallBars({
  data,
  color = "hsl(var(--primary))",
  suffix = "",
}: {
  data: Array<{ name: string; value: number }>;
  color?: string;
  suffix?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <ChartContainer config={simpleConfig} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => `${v}${suffix}`}
        />
        <YAxis hide allowDecimals={false} />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { name: string; value: number };
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <span className="font-semibold text-foreground">
                  {p.name}
                  {suffix}
                </span>
                <span className="ml-2 tabular-nums text-muted-foreground">{p.value} κρατήσεις</span>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={40} minPointSize={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={color} fillOpacity={d.value === max && max > 0 ? 1 : 0.45} />
          ))}
          <LabelList dataKey="value" position="top" offset={6} className="fill-foreground" fontSize={11} fontWeight={600} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
