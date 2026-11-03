import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { el } from "date-fns/locale";
import {
  LogIn,
  LogOut,
  AlertCircle,
  Clock,
  Sun,
  Plus,
  CalendarDays,
  Inbox,
  Wallet,
  MapPin,
  ChevronRight,
  CalendarRange,
  BarChart3,
  Route,
  BellRing,
  CheckCircle2,
} from "lucide-react";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { STATUS_CHIP, STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";
import {
  DashboardContainer,
  DashboardHeader,
  EmptyState,
  Panel,
  Segmented,
  StatTile,
  VehicleThumb,
} from "@/components/dashboard/primitives";
import { WhatsAppButton } from "@/components/dashboard/WhatsAppButton";
import { bookingBalance, formatEuro, TONE_SOFT, type Tone } from "@/components/dashboard/format";

type MoveKind = "pickup" | "return";
type ScheduleFilter = "all" | MoveKind;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const occupancyConfig = {
  pct: { label: "Πληρότητα", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export default function TodayPage() {
  const navigate = useNavigate();
  const { data: bookings = [], isLoading: loadingBookings } = useBookings();
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: requests = [] } = useBookingRequests();
  const isLoading = loadingBookings || loadingVehicles;
  const [filter, setFilter] = useState<ScheduleFilter>("all");

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])) as Record<string, Vehicle>,
    [vehicles],
  );

  const today = startOfDay(new Date());

  const arrivals = useMemo(
    () => bookings.filter((b) => isToday(parseISO(b.check_in)) && b.status !== "cancelled"),
    [bookings],
  );
  const departures = useMemo(
    () => bookings.filter((b) => isToday(parseISO(b.check_out)) && b.status !== "cancelled"),
    [bookings],
  );
  const pending = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings],
  );
  const overdueBalances = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status === "cancelled") return false;
        const total = Number(b.total_price) || 0;
        const deposit = Number(b.deposit_amount) || 0;
        return total - deposit > 0 && (isToday(parseISO(b.check_out)) || parseISO(b.check_out) < today);
      }),
    [bookings, today],
  );
  const newRequests = useMemo(() => requests.filter((r) => r.status === "new"), [requests]);

  const onRoad = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status === "cancelled") return false;
        const ci = startOfDay(parseISO(b.check_in));
        const co = startOfDay(parseISO(b.check_out));
        return ci <= today && co > today;
      }).length,
    [bookings, today],
  );

  const occupancyDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i);
      const booked = vehicles.filter((v) =>
        bookings.some((b) => {
          if (b.status === "cancelled" || b.vehicle_id !== v.id) return false;
          return isWithinInterval(day, {
            start: startOfDay(parseISO(b.check_in)),
            end: startOfDay(parseISO(b.check_out)),
          });
        }),
      ).length;
      return {
        day,
        booked,
        total: vehicles.length,
        pct: vehicles.length ? Math.round((booked / vehicles.length) * 100) : 0,
      };
    });
  }, [bookings, vehicles, today]);

  // Next 7 days agenda (tomorrow onwards)
  const agenda = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i + 1);
      const pickups = active.filter((b) => isSameDay(parseISO(b.check_in), day));
      const returns = active.filter((b) => isSameDay(parseISO(b.check_out), day));
      return { day, pickups, returns };
    });
  }, [bookings, today]);

  const schedule = useMemo(() => {
    const items: Array<{ kind: MoveKind; booking: Booking }> = [
      ...departures.map((booking) => ({ kind: "return" as const, booking })),
      ...arrivals.map((booking) => ({ kind: "pickup" as const, booking })),
    ];
    // Group by location so the driver can plan a route
    return items.sort((a, b) =>
      (a.booking.delivery_location ?? "~").localeCompare(b.booking.delivery_location ?? "~", "el"),
    );
  }, [arrivals, departures]);

  const visibleSchedule = filter === "all" ? schedule : schedule.filter((s) => s.kind === filter);

  const openBooking = (b: Booking) => navigate(`/booking/${b.id}`);

  if (isLoading) {
    return (
      <DashboardContainer>
        <Skeleton className="mb-2 h-4 w-40" />
        <Skeleton className="mb-8 h-10 w-56" />
        <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-[420px] rounded-xl" />
          <div className="space-y-5">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </DashboardContainer>
    );
  }

  const quiet =
    arrivals.length === 0 &&
    departures.length === 0 &&
    pending.length === 0 &&
    overdueBalances.length === 0;

  const overdueSum = overdueBalances.reduce((s, b) => s + bookingBalance(b), 0);
  const attentionCount = pending.length + overdueBalances.length + newRequests.length;
  const todayOcc = occupancyDays[0];

  const summary = quiet
    ? "Ήσυχη μέρα στο νησί — καμία κίνηση ή εκκρεμότητα για σήμερα."
    : `${plural(arrivals.length, "παραλαβή", "παραλαβές")} και ${plural(
        departures.length,
        "επιστροφή",
        "επιστροφές",
      )} σήμερα${attentionCount ? ` · ${plural(attentionCount, "θέμα θέλει", "θέματα θέλουν")} προσοχή` : ""}.`;

  return (
    <DashboardContainer>
      <DashboardHeader
        eyebrow={format(new Date(), "EEEE d MMMM yyyy", { locale: el })}
        title="Σήμερα"
        description={summary}
        actions={
          <>
            <Button variant="outline" className="h-10 rounded-full px-4 coarse:h-11" onClick={() => navigate("/bookings")}>
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Κρατήσεις
            </Button>
            <Button className="h-10 rounded-full px-5 coarse:h-11" onClick={() => navigate("/booking/new")}>
              <Plus className="mr-1.5 h-4 w-4" />
              Νέα κράτηση
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatTile
          label="Αφίξεις"
          value={arrivals.length}
          icon={LogIn}
          tone="success"
          hint="Παραλαβές σήμερα"
          onClick={() => {
            setFilter("pickup");
            scrollToId("today-schedule");
          }}
          active={filter === "pickup"}
        />
        <StatTile
          label="Αναχωρήσεις"
          value={departures.length}
          icon={LogOut}
          tone="accent"
          hint="Επιστροφές σήμερα"
          onClick={() => {
            setFilter("return");
            scrollToId("today-schedule");
          }}
          active={filter === "return"}
        />
        <StatTile
          label="Εκκρεμείς"
          value={pending.length}
          icon={Clock}
          tone="warning"
          hint={newRequests.length ? `+ ${plural(newRequests.length, "νέο αίτημα", "νέα αιτήματα")}` : "Θέλουν επιβεβαίωση"}
          onClick={() => scrollToId("today-attention")}
        />
        <StatTile
          label="Υπόλοιπα"
          value={overdueBalances.length}
          icon={AlertCircle}
          tone="destructive"
          hint={overdueSum > 0 ? `${formatEuro(overdueSum)} προς είσπραξη` : "Όλα εξοφλημένα"}
          onClick={() => scrollToId("today-attention")}
        />
      </div>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Main column */}
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <Panel
            id="today-schedule"
            className="order-1 scroll-mt-20 xl:order-none"
            icon={Route}
            title="Πρόγραμμα ημέρας"
            description={
              schedule.length
                ? `${plural(schedule.length, "κίνηση", "κινήσεις")} · ταξινόμηση ανά σημείο παράδοσης`
                : "Παραλαβές και επιστροφές σήμερα"
            }
            action={
              schedule.length > 0 ? (
                <Segmented<ScheduleFilter>
                  value={filter}
                  onChange={setFilter}
                  className="hidden sm:inline-flex"
                  options={[
                    { value: "all", label: "Όλα", count: schedule.length },
                    { value: "pickup", label: "Παραλαβές", count: arrivals.length },
                    { value: "return", label: "Επιστροφές", count: departures.length },
                  ]}
                />
              ) : undefined
            }
            bodyClassName="px-0 md:px-0 pb-2 md:pb-2"
          >
            {schedule.length > 0 && (
              <div className="px-4 pb-3 sm:hidden">
                <Segmented<ScheduleFilter>
                  value={filter}
                  onChange={setFilter}
                  className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
                  options={[
                    { value: "all", label: "Όλα", count: schedule.length },
                    { value: "pickup", label: "Παραλαβές", count: arrivals.length },
                    { value: "return", label: "Επιστροφές", count: departures.length },
                  ]}
                />
              </div>
            )}

            {quiet ? (
              <EmptyState
                icon={Sun}
                title="Ήσυχη μέρα στο νησί"
                description="Δεν υπάρχουν αφίξεις, αναχωρήσεις ή εκκρεμότητες για σήμερα. Μπορείτε να προγραμματίσετε νέα κράτηση."
                action={
                  <Button className="rounded-full px-5" onClick={() => navigate("/booking/new")}>
                    Νέα κράτηση
                  </Button>
                }
                className="py-14"
              />
            ) : visibleSchedule.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={schedule.length ? "Τίποτα σε αυτή την προβολή" : "Καμία παραλαβή ή επιστροφή σήμερα"}
                description={
                  schedule.length
                    ? "Αλλάξτε φίλτρο για να δείτε τις υπόλοιπες κινήσεις."
                    : "Δείτε δεξιά τις εκκρεμότητες που θέλουν προσοχή."
                }
              />
            ) : (
              <ol className="relative">
                {visibleSchedule.map((item, idx) => (
                  <TimelineRow
                    key={`${item.kind}-${item.booking.id}`}
                    kind={item.kind}
                    booking={item.booking}
                    vehicle={vehicleMap[item.booking.vehicle_id]}
                    isLast={idx === visibleSchedule.length - 1}
                    onOpen={openBooking}
                  />
                ))}
              </ol>
            )}
          </Panel>

          <Panel
            className="order-4 xl:order-none"
            icon={CalendarRange}
            title="Επόμενες 7 ημέρες"
            description="Παραλαβές και επιστροφές που έρχονται"
            action={
              <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={() => navigate("/bookings")}>
                Ημερολόγιο
                <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Button>
            }
            bodyClassName="px-0 md:px-0 pb-1 md:pb-1"
          >
            <ul className="divide-y divide-border">
              {agenda.map((d) => (
                <AgendaDay
                  key={d.day.toISOString()}
                  day={d.day}
                  pickups={d.pickups}
                  returns={d.returns}
                  vehicleMap={vehicleMap}
                  onOpen={openBooking}
                />
              ))}
            </ul>
          </Panel>
        </div>

        {/* Right rail */}
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <Panel
            id="today-attention"
            className="order-2 scroll-mt-20 xl:order-none"
            icon={BellRing}
            title="Χρειάζεται προσοχή"
            description={attentionCount ? plural(attentionCount, "εκκρεμότητα", "εκκρεμότητες") : "Όλα σε τάξη"}
            bodyClassName="px-0 md:px-0 pb-2 md:pb-2"
          >
            {attentionCount === 0 ? (
              <EmptyState icon={CheckCircle2} title="Καμία εκκρεμότητα" description="Δεν υπάρχουν επιβεβαιώσεις ή ανοιχτά υπόλοιπα." className="py-8" />
            ) : (
              <div className="space-y-1">
                <AttentionGroup
                  title="Νέα αιτήματα"
                  tone="primary"
                  icon={Inbox}
                  items={newRequests.map((r) => ({
                    id: r.id,
                    title: r.customer_name,
                    subtitle: `${r.requested_vehicle ?? "Όχημα"} · ${format(parseISO(r.check_in), "d MMM", { locale: el })} → ${format(parseISO(r.check_out), "d MMM", { locale: el })}`,
                    onClick: () => navigate("/requests"),
                  }))}
                />
                <AttentionGroup
                  title="Εκκρεμείς επιβεβαιώσεις"
                  tone="warning"
                  icon={Clock}
                  items={pending.map((b) => ({
                    id: b.id,
                    title: b.customer_name,
                    subtitle: `${vehicleMap[b.vehicle_id]?.name ?? "Όχημα"} · ${format(parseISO(b.check_in), "d MMM", { locale: el })} → ${format(parseISO(b.check_out), "d MMM", { locale: el })}`,
                    meta: "Θέλει επιβεβαίωση",
                    onClick: () => openBooking(b),
                  }))}
                />
                <AttentionGroup
                  title="Ανοιχτά υπόλοιπα"
                  tone="destructive"
                  icon={Wallet}
                  items={overdueBalances.map((b) => ({
                    id: b.id,
                    title: b.customer_name,
                    subtitle: `${vehicleMap[b.vehicle_id]?.name ?? "Όχημα"} · checkout ${format(parseISO(b.check_out), "dd/MM")}`,
                    amount: formatEuro(bookingBalance(b)),
                    onClick: () => openBooking(b),
                  }))}
                />
              </div>
            )}
          </Panel>

          <Panel
            className="order-3 xl:order-none"
            icon={BarChart3}
            title="Πληρότητα 7 ημερών"
            description={
              todayOcc
                ? `Σήμερα ${todayOcc.booked}/${todayOcc.total} οχήματα · ${onRoad} σε κυκλοφορία`
                : undefined
            }
            action={
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums text-foreground">
                Μ.Ο.{" "}
                {occupancyDays.length
                  ? Math.round(occupancyDays.reduce((s, d) => s + d.pct, 0) / occupancyDays.length)
                  : 0}
                %
              </span>
            }
          >
            <OccupancyChart days={occupancyDays} />
          </Panel>

          <Panel className="order-5 xl:order-none" title="Γρήγορες ενέργειες">
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={Plus} label="Νέα κράτηση" onClick={() => navigate("/booking/new")} primary />
              <QuickAction icon={CalendarDays} label="Κρατήσεις" onClick={() => navigate("/bookings")} />
              <QuickAction
                icon={Inbox}
                label="Αιτήματα"
                badge={newRequests.length || undefined}
                onClick={() => navigate("/requests")}
              />
              <QuickAction icon={Wallet} label="Οικονομικά" onClick={() => navigate("/money")} />
            </div>
          </Panel>
        </div>
      </div>
    </DashboardContainer>
  );
}

/* ───────────── Timeline ───────────── */

const KIND_META: Record<MoveKind, { label: string; icon: typeof LogIn; tone: Tone; line: string }> = {
  pickup: { label: "Παραλαβή σήμερα", icon: LogIn, tone: "success", line: "bg-success/30" },
  return: { label: "Επιστροφή σήμερα", icon: LogOut, tone: "accent", line: "bg-accent/30" },
};

function TimelineRow({
  kind,
  booking: b,
  vehicle,
  isLast,
  onOpen,
}: {
  kind: MoveKind;
  booking: Booking;
  vehicle?: Vehicle;
  isLast: boolean;
  onOpen: (b: Booking) => void;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const balance = bookingBalance(b);
  const days = Math.max(differenceInCalendarDays(parseISO(b.check_out), parseISO(b.check_in)), 1);
  const vehicleName = vehicle?.name ?? "Όχημα";

  return (
    <li className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(b)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(b);
          }
        }}
        className="group flex cursor-pointer select-none gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none active:bg-muted md:gap-4 md:px-5"
      >
        {/* Node + connector */}
        <div className="relative flex w-9 shrink-0 justify-center">
          <span className={cn("relative z-10 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full", TONE_SOFT[meta.tone])}>
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
          {!isLast && <span className="absolute bottom-[-12px] top-11 w-px bg-border" aria-hidden />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TONE_SOFT[meta.tone])}>{meta.label}</span>
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", STATUS_CHIP[b.status])}>
              {STATUS_LABELS[b.status]}
            </Badge>
            {kind === "return" && balance > 0 && (
              <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive tabular-nums">
                υπόλοιπο {formatEuro(balance)}
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate text-[15px] font-semibold text-foreground">
            {vehicleName}
            {b.plate && <span className="ml-2 text-xs font-medium text-muted-foreground">{b.plate}</span>}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
            <span className="truncate font-medium text-foreground/80">{b.customer_name}</span>
            {b.delivery_location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{b.delivery_location}</span>
              </span>
            )}
            <span className="tabular-nums">
              {plural(days, "ημέρα", "ημέρες")} ·{" "}
              {kind === "pickup"
                ? `έως ${format(parseISO(b.check_out), "EEE d MMM", { locale: el })}`
                : `από ${format(parseISO(b.check_in), "EEE d MMM", { locale: el })}`}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 self-center">
          <WhatsAppButton booking={b} vehicleName={vehicle?.name ?? ""} />
          <VehicleThumb src={vehicle?.image_url} alt={vehicleName} className="hidden h-14 w-20 sm:flex" />
        </div>
      </div>
    </li>
  );
}

/* ───────────── Agenda ───────────── */

function AgendaDay({
  day,
  pickups,
  returns,
  vehicleMap,
  onOpen,
}: {
  day: Date;
  pickups: Booking[];
  returns: Booking[];
  vehicleMap: Record<string, Vehicle>;
  onOpen: (b: Booking) => void;
}) {
  const empty = pickups.length === 0 && returns.length === 0;
  const moves: Array<{ kind: MoveKind; b: Booking }> = [
    ...pickups.map((b) => ({ kind: "pickup" as const, b })),
    ...returns.map((b) => ({ kind: "return" as const, b })),
  ];
  const isTomorrow = differenceInCalendarDays(day, new Date()) === 1;

  return (
    <li className="flex gap-3 px-4 py-3 md:gap-5 md:px-5">
      <div className="w-12 shrink-0 pt-0.5 text-center md:w-14">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isTomorrow ? "Αύριο" : format(day, "EEE", { locale: el })}
        </p>
        <p className={cn("text-[22px] font-bold leading-tight tabular-nums", empty ? "text-muted-foreground/60" : "text-foreground")}>
          {format(day, "d")}
        </p>
        <p className="text-[11px] text-muted-foreground">{format(day, "MMM", { locale: el })}</p>
      </div>

      <div className="min-w-0 flex-1">
        {empty ? (
          <p className="pt-3 text-[13px] text-muted-foreground">Χωρίς κινήσεις</p>
        ) : (
          <>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {[
                pickups.length ? plural(pickups.length, "παραλαβή", "παραλαβές") : null,
                returns.length ? plural(returns.length, "επιστροφή", "επιστροφές") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="grid gap-1.5 2xl:grid-cols-2">
              {moves.map(({ kind, b }) => {
                const meta = KIND_META[kind];
                const Icon = meta.icon;
                return (
                  <button
                    key={`${kind}-${b.id}`}
                    type="button"
                    onClick={() => onOpen(b)}
                    className="pressable flex min-h-[44px] w-full min-w-0 items-center gap-2.5 rounded-lg border border-border bg-background px-2.5 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40"
                  >
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", TONE_SOFT[meta.tone])}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">
                        {vehicleMap[b.vehicle_id]?.name ?? "Όχημα"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {b.customer_name}
                        {b.delivery_location ? ` · ${b.delivery_location}` : ""}
                      </span>
                    </span>
                    {b.status === "pending" && <span className="h-2 w-2 shrink-0 rounded-full bg-warning" title={STATUS_LABELS.pending} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

/* ───────────── Attention list ───────────── */

const ATTENTION_PREVIEW = 4;

function AttentionGroup({
  title,
  tone,
  icon: Icon,
  items,
}: {
  title: string;
  tone: Tone;
  icon: typeof Clock;
  items: Array<{ id: string; title: string; subtitle: string; meta?: string; amount?: string; onClick: () => void }>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, ATTENTION_PREVIEW);

  return (
    <div>
      <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:px-5">
        {title}
        <span className="tabular-nums">· {items.length}</span>
      </p>
      <ul>
        {shown.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={it.onClick}
              className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted md:px-5"
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE_SOFT[tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{it.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{it.subtitle}</span>
              </span>
              {it.amount ? (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">{it.amount}</span>
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          </li>
        ))}
      </ul>
      {items.length > ATTENTION_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-h-[40px] w-full px-4 text-left text-[13px] font-medium text-primary hover:underline md:px-5"
        >
          {expanded ? "Λιγότερα" : `Προβολή όλων (${items.length})`}
        </button>
      )}
    </div>
  );
}

/* ───────────── Occupancy chart ───────────── */

function OccupancyChart({ days }: { days: Array<{ day: Date; booked: number; total: number; pct: number }> }) {
  const data = days.map((d, i) => ({
    label: i === 0 ? "Σήμερα" : format(d.day, "EEE d", { locale: el }),
    pct: d.pct,
    booked: d.booked,
    total: d.total,
    isToday: i === 0,
  }));

  return (
    <ChartContainer config={occupancyConfig} className="aspect-auto h-[200px] w-full">
      <BarChart data={data} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          tick={{ fontSize: 11 }}
        />
        <YAxis hide domain={[0, 100]} />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as (typeof data)[number];
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="font-semibold capitalize text-foreground">{p.label}</p>
                <p className="mt-0.5 text-muted-foreground tabular-nums">
                  {p.booked}/{p.total} οχήματα · {p.pct}%
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="pct" radius={[6, 6, 2, 2]} maxBarSize={36} minPointSize={3}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.isToday ? "hsl(var(--accent))" : "hsl(var(--primary))"} fillOpacity={d.isToday ? 1 : 0.85} />
          ))}
          <LabelList
            dataKey="pct"
            position="top"
            offset={6}
            className="fill-foreground"
            fontSize={11}
            fontWeight={600}
            formatter={(v: number) => `${v}%`}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/* ───────────── Quick action ───────────── */

function QuickAction({
  icon: Icon,
  label,
  onClick,
  primary,
  badge,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  primary?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable relative flex min-h-[64px] flex-col items-start justify-between gap-2 rounded-lg border p-3 text-left text-[13px] font-semibold transition-colors",
        primary
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-background text-foreground hover:border-foreground/20 hover:bg-muted/40",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.2} />
      {label}
      {badge !== undefined && (
        <span className="absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}
