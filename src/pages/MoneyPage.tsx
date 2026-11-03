import { useMemo, useState, type ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getMonth,
  getYear,
  isToday,
  isWithinInterval,
  parseISO,
  setYear,
  startOfDay,
  startOfMonth,
  subMonths,
  subYears,
} from "date-fns";
import { el } from "date-fns/locale";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Receipt,
  Car,
  CreditCard,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Rectangle, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/hooks/useVehicles";
import {
  DashboardContainer,
  DashboardHeader,
  DeltaPill,
  EmptyState,
  LegendDot,
  Panel,
  VehicleThumb,
} from "@/components/dashboard/primitives";
import {
  bookingBalance,
  bookingPaid,
  bookingTotal,
  formatEuro,
  formatEuroCompact,
  percentDelta,
} from "@/components/dashboard/format";

const COLLECTED_COLOR = "hsl(var(--primary))";
const OPEN_COLOR = "hsl(var(--accent))";

const chartConfig = {
  collected: { label: "Εισπραγμένα", color: COLLECTED_COLOR },
  open: { label: "Ανοιχτά", color: OPEN_COLOR },
} satisfies ChartConfig;

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Μετρητά",
  bank: "Τραπεζική κατάθεση",
  iris: "IRIS",
  card: "Κάρτα",
};

const BALANCE_PREVIEW = 8;

export default function MoneyPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: bookings = [], isLoading } = useBookings();
  const { data: vehicles = [] } = useVehicles();
  const [month, setMonth] = useState(() => new Date());
  const [showAllBalances, setShowAllBalances] = useState(false);

  const year = getYear(month);
  const today = startOfDay(new Date());

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])) as Record<string, Vehicle>,
    [vehicles],
  );

  /* ── Month cash (selected month, overlapping bookings) ── */
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const monthBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status === "cancelled") return false;
        const checkIn = parseISO(b.check_in);
        const checkOut = parseISO(b.check_out);
        return (
          isWithinInterval(checkIn, { start: monthStart, end: monthEnd }) ||
          isWithinInterval(checkOut, { start: monthStart, end: monthEnd }) ||
          (checkIn <= monthStart && checkOut >= monthEnd)
        );
      }),
    [bookings, monthStart, monthEnd],
  );

  const expected = monthBookings.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  const collected = monthBookings.reduce((s, b) => s + (Number(b.deposit_amount) || 0), 0);
  const remaining = expected - collected;
  const collectedPct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;

  /* ── Open balances (all time) ── */
  const openBalances = useMemo(
    () =>
      bookings
        .filter((b) => {
          if (b.status === "cancelled") return false;
          return (Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0) > 0;
        })
        .map((b) => ({
          ...b,
          balance: (Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0),
        }))
        .sort((a, b) => b.balance - a.balance),
    [bookings],
  );

  const checkoutToday = openBalances.filter((b) => isToday(parseISO(b.check_out)));
  const openTotal = openBalances.reduce((s, b) => s + b.balance, 0);

  /* ── Year view (by pickup month) ── */
  const yearData = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const inYear = active.filter((b) => getYear(parseISO(b.check_in)) === year);

    const months = Array.from({ length: 12 }, (_, m) => ({
      m,
      label: format(new Date(year, m, 1), "LLL", { locale: el }),
      collected: 0,
      open: 0,
      total: 0,
      count: 0,
    }));
    inYear.forEach((b) => {
      const row = months[getMonth(parseISO(b.check_in))];
      row.collected += bookingPaid(b);
      row.open += Math.max(bookingBalance(b), 0);
      row.total += bookingTotal(b);
      row.count += 1;
    });

    const total = inYear.reduce((s, b) => s + bookingTotal(b), 0);
    const paid = inYear.reduce((s, b) => s + bookingPaid(b), 0);

    // Year-to-date comparison against the same period last year
    const isCurrentYear = year === getYear(today);
    const cutoffPrev = isCurrentYear ? subYears(today, 1) : new Date(year - 1, 11, 31);
    const prevTotal = active
      .filter((b) => {
        const ci = parseISO(b.check_in);
        return getYear(ci) === year - 1 && ci <= cutoffPrev;
      })
      .reduce((s, b) => s + bookingTotal(b), 0);

    // Per vehicle
    const perVehicle: Record<string, { revenue: number; paid: number; count: number; days: number }> = {};
    inYear.forEach((b) => {
      const row = (perVehicle[b.vehicle_id] ??= { revenue: 0, paid: 0, count: 0, days: 0 });
      row.revenue += bookingTotal(b);
      row.paid += bookingPaid(b);
      row.count += 1;
      row.days += Math.max(differenceInCalendarDays(parseISO(b.check_out), parseISO(b.check_in)), 1);
    });
    const vehicleRows = vehicles
      .map((v) => ({ vehicle: v, ...(perVehicle[v.id] ?? { revenue: 0, paid: 0, count: 0, days: 0 }) }))
      .filter((r) => r.count > 0 || r.vehicle.active)
      .sort((a, b) => b.revenue - a.revenue);

    // Payment methods (collected amounts)
    const methods: Record<string, number> = {};
    inYear.forEach((b) => {
      const paidAmt = bookingPaid(b);
      if (paidAmt <= 0) return;
      const key = b.payment_method || "cash";
      methods[key] = (methods[key] || 0) + paidAmt;
    });
    const methodRows = Object.entries(methods)
      .map(([key, value]) => ({ key, label: PAYMENT_LABELS[key] ?? key, value }))
      .sort((a, b) => b.value - a.value);

    return {
      months,
      total,
      paid,
      open: Math.max(total - paid, 0),
      count: inYear.length,
      delta: percentDelta(total, prevTotal),
      isCurrentYear,
      vehicleRows,
      methodRows,
    };
  }, [bookings, vehicles, year, today]);

  const selectedMonthIdx = getMonth(month);
  const topRevenue = yearData.vehicleRows[0]?.revenue || 0;
  const shownBalances = showAllBalances ? openBalances : openBalances.slice(0, BALANCE_PREVIEW);
  const methodsTotal = yearData.methodRows.reduce((s, r) => s + r.value, 0);

  const changeYear = (delta: number) => setMonth((m) => setYear(m, getYear(m) + delta));

  return (
    <DashboardContainer>
      <DashboardHeader
        eyebrow={`Ταμείο · ${format(month, "LLLL yyyy", { locale: el })}`}
        title="Οικονομικά"
        description={
          isLoading
            ? undefined
            : openTotal > 0
              ? `${formatEuro(openTotal)} ανοιχτά υπόλοιπα σε ${openBalances.length} ${openBalances.length === 1 ? "κράτηση" : "κρατήσεις"}.`
              : "Όλα εξοφλημένα — δεν υπάρχουν ανοιχτά υπόλοιπα."
        }
        actions={
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full coarse:h-10 coarse:w-10" onClick={() => changeYear(-1)} aria-label="Προηγούμενο έτος">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[56px] text-center text-sm font-semibold tabular-nums">{year}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full coarse:h-10 coarse:w-10" onClick={() => changeYear(1)} aria-label="Επόμενο έτος">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-[460px] rounded-xl" />
          <div className="space-y-5">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_420px]">
            {/* ── Earnings hero (Turo-style) ── */}
            <section className="min-w-0 rounded-xl border border-border bg-card p-4 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[13px] font-medium text-muted-foreground">Έσοδα έτους</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums text-foreground md:text-[44px]">
                      {formatEuro(yearData.total)}
                    </span>
                    <span className="text-lg font-semibold text-muted-foreground">το {year}</span>
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    <DeltaPill value={yearData.delta} />
                    <span>
                      {yearData.isCurrentYear ? `έναντι ίδιας περιόδου ${year - 1}` : `έναντι ${year - 1}`} ·{" "}
                      {yearData.count} {yearData.count === 1 ? "κράτηση" : "κρατήσεις"}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end md:pt-1">
                  <LegendValue color={COLLECTED_COLOR} label="Εισπραγμένα" value={formatEuro(yearData.paid)} />
                  <LegendValue color={OPEN_COLOR} label="Ανοιχτά" value={formatEuro(yearData.open)} />
                </div>
              </div>

              <ChartContainer config={chartConfig} className="mt-6 aspect-auto h-[240px] w-full md:h-[300px]">
                <BarChart
                  data={yearData.months}
                  margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                  onClick={(state) => {
                    const idx = state?.activeTooltipIndex;
                    if (typeof idx === "number") setMonth(new Date(year, idx, 1));
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={isMobile ? 1 : 0}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.replace(".", "")}
                  />
                  <YAxis
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={isMobile ? 44 : 56}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => formatEuroCompact(v)}
                  />
                  <ChartTooltip
                    cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof yearData.months)[number];
                      return (
                        <div className="min-w-[180px] rounded-lg border border-border bg-popover px-3 py-2.5 text-xs shadow-md">
                          <p className="mb-1.5 font-semibold capitalize text-foreground">
                            {format(new Date(year, p.m, 1), "LLLL yyyy", { locale: el })}
                          </p>
                          <TooltipRow color={COLLECTED_COLOR} label="Εισπραγμένα" value={formatEuro(p.collected)} />
                          <TooltipRow color={OPEN_COLOR} label="Ανοιχτά" value={formatEuro(p.open)} />
                          <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-semibold text-foreground">
                            <span>Σύνολο · {p.count}</span>
                            <span className="tabular-nums">{formatEuro(p.total)}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="collected"
                    stackId="a"
                    fill={COLLECTED_COLOR}
                    maxBarSize={44}
                    className="cursor-pointer"
                    shape={(props: ComponentProps<typeof Rectangle> & { payload?: { open: number } }) => (
                      <Rectangle {...props} radius={props.payload && props.payload.open > 0 ? 0 : [6, 6, 0, 0]} />
                    )}
                  >
                    {yearData.months.map((d) => (
                      <Cell key={d.m} fillOpacity={d.m === selectedMonthIdx ? 1 : 0.55} />
                    ))}
                  </Bar>
                  <Bar dataKey="open" stackId="a" fill={OPEN_COLOR} radius={[6, 6, 0, 0]} maxBarSize={44} className="cursor-pointer">
                    {yearData.months.map((d) => (
                      <Cell key={d.m} fillOpacity={d.m === selectedMonthIdx ? 1 : 0.55} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                Ανά μήνα παραλαβής · πατήστε μια στήλη για να δείτε το ταμείο του μήνα.
              </p>
            </section>

            {/* ── Right rail ── */}
            <div className="flex min-w-0 flex-col gap-5">
              <Panel
                title={<span className="capitalize">{format(month, "LLLL yyyy", { locale: el })}</span>}
                description={`Ταμείο μήνα · ${monthBookings.length} ${monthBookings.length === 1 ? "κράτηση" : "κρατήσεις"}`}
                action={
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full coarse:h-10 coarse:w-10" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Προηγούμενος μήνας">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full coarse:h-10 coarse:w-10" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Επόμενος μήνας">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                }
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-muted-foreground">Εισπράχθηκε</span>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{collectedPct}%</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-accent/20">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${collectedPct}%` }} />
                    </div>
                  </div>

                  <dl className="divide-y divide-border rounded-lg border border-border">
                    <CashRow icon={Wallet} tone="text-primary" label="Αναμενόμενα" value={formatEuro(expected)} />
                    <CashRow icon={ArrowDownLeft} tone="text-success" label="Εισπραγμένα" value={formatEuro(collected)} />
                    <CashRow icon={ArrowUpRight} tone="text-accent" label="Υπόλοιπο μήνα" value={formatEuro(remaining)} strong />
                  </dl>
                </div>
              </Panel>

              {checkoutToday.length > 0 && (
                <Panel
                  icon={AlertCircle}
                  title="Υπόλοιπα με checkout σήμερα"
                  description="Εισπράξτε κατά την επιστροφή"
                  className="border-accent/40"
                  bodyClassName="px-0 md:px-0 pb-2 md:pb-2"
                >
                  <ul>
                    {checkoutToday.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/booking/${b.id}`)}
                          className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted md:px-5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{b.customer_name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {vehicleMap[b.vehicle_id]?.name}
                              {b.payment_notes ? ` · ${b.payment_notes}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">{formatEuro(b.balance)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              <Panel icon={CreditCard} title="Τρόποι πληρωμής" description={`Εισπράξεις ${year}`}>
                {yearData.methodRows.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Δεν υπάρχουν εισπράξεις.</p>
                ) : (
                  <ul className="space-y-3">
                    {yearData.methodRows.map((r) => {
                      const pct = methodsTotal ? Math.round((r.value / methodsTotal) * 100) : 0;
                      return (
                        <li key={r.key}>
                          <div className="flex items-baseline justify-between gap-2 text-[13px]">
                            <span className="font-medium text-foreground">{r.label}</span>
                            <span className="tabular-nums text-muted-foreground">
                              <span className="font-semibold text-foreground">{formatEuro(r.value)}</span> · {pct}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          {/* ── Lists ── */}
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel
              icon={Receipt}
              title={`Ανοιχτά υπόλοιπα (${openBalances.length})`}
              description={openBalances.length ? `Σύνολο ${formatEuro(openTotal)}` : undefined}
              bodyClassName="px-0 md:px-0 pb-1 md:pb-1"
            >
              {openBalances.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Όλα εξοφλημένα" description="Δεν υπάρχουν ανοιχτά υπόλοιπα." />
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(0,1fr)_88px_120px_96px] gap-3 border-b border-border px-5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Πελάτης</span>
                    <span>Checkout</span>
                    <span>Πληρωμένα</span>
                    <span className="text-right">Υπόλοιπο</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {shownBalances.map((b) => {
                      const total = Number(b.total_price) || 0;
                      const paidPct = total ? Math.max(0, Math.min(100, Math.round(((total - b.balance) / total) * 100))) : 0;
                      const co = parseISO(b.check_out);
                      const overdue = co < today;
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/booking/${b.id}`)}
                            className="grid min-h-[60px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted md:grid-cols-[minmax(0,1fr)_88px_120px_96px] md:px-5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">{b.customer_name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {vehicleMap[b.vehicle_id]?.name}
                                <span className="md:hidden"> · checkout {format(co, "dd/MM")}</span>
                                {b.payment_notes ? ` · ${b.payment_notes}` : ""}
                              </span>
                            </span>
                            <span className={cn("hidden text-[13px] tabular-nums md:block", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                              {format(co, "dd/MM/yy")}
                            </span>
                            <span className="hidden md:block">
                              <span className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                                <span>{formatEuro(total - b.balance)}</span>
                                <span>από {formatEuro(total)}</span>
                              </span>
                              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                                <span className="block h-full rounded-full bg-success" style={{ width: `${paidPct}%` }} />
                              </span>
                            </span>
                            <span className="text-right">
                              <span className={cn("block text-sm font-semibold tabular-nums", overdue ? "text-destructive" : "text-accent")}>
                                {formatEuro(b.balance)}
                              </span>
                              <span className="block text-[11px] text-muted-foreground md:hidden">από {formatEuro(total)}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {openBalances.length > BALANCE_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setShowAllBalances((v) => !v)}
                      className="min-h-[44px] w-full border-t border-border px-4 text-left text-[13px] font-medium text-primary hover:underline md:px-5"
                    >
                      {showAllBalances ? "Λιγότερα" : `Προβολή όλων (${openBalances.length})`}
                    </button>
                  )}
                </>
              )}
            </Panel>

            <Panel
              icon={Car}
              title="Ανά όχημα"
              description={`Έσοδα ${year} ανά όχημα`}
              bodyClassName="px-0 md:px-0 pb-1 md:pb-1"
            >
              {yearData.vehicleRows.length === 0 ? (
                <EmptyState icon={Car} title="Χωρίς οχήματα" description="Προσθέστε οχήματα στον στόλο." />
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(0,1fr)_80px_70px_110px] gap-3 border-b border-border px-5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Όχημα</span>
                    <span className="text-right">Κρατήσεις</span>
                    <span className="text-right">Ημέρες</span>
                    <span className="text-right">Έσοδα {year}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {yearData.vehicleRows.map((r) => {
                      const share = topRevenue ? Math.round((r.revenue / topRevenue) * 100) : 0;
                      return (
                        <li
                          key={r.vehicle.id}
                          className={cn(
                            "grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 md:grid-cols-[minmax(0,1fr)_80px_70px_110px] md:px-5",
                            r.count === 0 && "opacity-60",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <VehicleThumb src={r.vehicle.image_url} alt={r.vehicle.name} className="h-10 w-14" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">{r.vehicle.name}</span>
                              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                                <span className="block h-full rounded-full bg-primary/70" style={{ width: `${share}%` }} />
                              </span>
                              <span className="mt-1 block text-[11px] text-muted-foreground md:hidden">
                                {r.count} κρατ. · {r.days} ημ.
                              </span>
                            </span>
                          </span>
                          <span className="hidden text-right text-[13px] tabular-nums text-muted-foreground md:block">{r.count}</span>
                          <span className="hidden text-right text-[13px] tabular-nums text-muted-foreground md:block">{r.days}</span>
                          <span className="text-right text-sm font-semibold tabular-nums text-foreground">{formatEuro(r.revenue)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}
    </DashboardContainer>
  );
}

function LegendValue({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <LegendDot color={color} />
      <span className="text-[13px] text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">{value}</span> {label}
      </span>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
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

function CashRow({
  icon: Icon,
  tone,
  label,
  value,
  strong,
}: {
  icon: typeof Wallet;
  tone: string;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Icon className={cn("h-4 w-4", tone)} />
        {label}
      </dt>
      <dd className={cn("tabular-nums text-foreground", strong ? "text-xl font-bold" : "text-lg font-semibold")}>{value}</dd>
    </div>
  );
}
