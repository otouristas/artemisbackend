import { useMemo, type ReactNode } from "react";
import { format, isSameMonth, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, Bike, Car, Clock3, KeyRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";
import type { VehicleBlock } from "@/hooks/useVehicleBlocks";
import { finance, isoDay, money } from "@/components/bookings/bookingUtils";

interface BookingsKpisProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  blocks: VehicleBlock[];
  month: Date;
  onPending: () => void;
  onInStay: () => void;
}

export function BookingsKpis({ vehicles, bookings, blocks, month, onPending, onInStay }: BookingsKpisProps) {
  const todayKey = isoDay(new Date());

  const stats = useMemo(() => {
    const live = bookings.filter((b) => b.status !== "cancelled");
    const arrivals = live.filter((b) => b.check_in === todayKey);
    const departures = live.filter((b) => b.check_out === todayKey);

    const byType = { car: { free: 0, total: 0 }, scooter: { free: 0, total: 0 } };
    let onRent = 0;
    let blocked = 0;
    const full: string[] = [];
    for (const v of vehicles) {
      const qty = Math.max(1, v.quantity ?? 1);
      const isBlocked = blocks.some(
        (bl) => bl.vehicle_id === v.id && bl.start_date <= todayKey && todayKey <= bl.end_date,
      );
      const taken = Math.min(
        qty,
        live.filter((b) => b.vehicle_id === v.id && b.check_in <= todayKey && todayKey < b.check_out).length,
      );
      const free = isBlocked ? 0 : qty - taken;
      onRent += taken;
      if (isBlocked) blocked += qty - taken;
      if (!isBlocked && free === 0) full.push(v.name);
      const t = byType[v.type] ?? byType.car;
      t.free += free;
      t.total += qty;
    }
    const totalUnits = byType.car.total + byType.scooter.total;
    const freeUnits = byType.car.free + byType.scooter.free;

    const pending = live.filter((b) => b.status === "pending" && b.check_out >= todayKey);
    const pendingSoon = pending.filter((b) => b.check_in <= isoDay(new Date(Date.now() + 7 * 864e5))).length;

    let revenue = 0;
    let outstanding = 0;
    let monthCount = 0;
    for (const b of live) {
      if (!isSameMonth(parseISO(b.check_in), month)) continue;
      const f = finance(b);
      revenue += f.total;
      outstanding += f.remaining;
      monthCount++;
    }

    return {
      arrivals,
      departures,
      byType,
      onRent,
      blocked,
      full,
      totalUnits,
      freeUnits,
      pending: pending.length,
      pendingSoon,
      revenue,
      outstanding,
      monthCount,
    };
  }, [vehicles, bookings, blocks, month, todayKey]);

  const utilisation = stats.totalUnits ? Math.round((stats.onRent / stats.totalUnits) * 100) : 0;

  return (
    <div className="-mx-3 mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
      <Kpi
        icon={<ArrowDownLeft className="h-4 w-4" />}
        tone="text-success bg-success/10"
        label="Σήμερα"
        value={
          <span className="flex items-baseline gap-3">
            <span>
              {stats.arrivals.length}
              <span className="ml-1 text-xs font-medium text-muted-foreground">παραλ.</span>
            </span>
            <span>
              {stats.departures.length}
              <span className="ml-1 text-xs font-medium text-muted-foreground">επιστρ.</span>
            </span>
          </span>
        }
        sub={
          stats.arrivals.length + stats.departures.length === 0
            ? "Καμία κίνηση σήμερα"
            : [...stats.arrivals, ...stats.departures]
                .slice(0, 3)
                .map((b) => b.customer_name.split(" ")[0])
                .join(", ")
        }
      />
      <Kpi
        icon={<KeyRound className="h-4 w-4" />}
        tone="text-primary bg-primary/10"
        label="Σε ενοικίαση"
        onClick={onInStay}
        value={
          <>
            {stats.onRent}
            <span className="text-base font-medium text-muted-foreground">/{stats.totalUnits}</span>
          </>
        }
        sub={
          <span className="flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${utilisation}%` }} />
            </span>
            <span className="tabular-nums">{utilisation}%</span>
          </span>
        }
      />
      <Kpi
        icon={<Car className="h-4 w-4" />}
        tone="text-foreground bg-muted"
        label="Ελεύθερα σήμερα"
        value={
          <>
            {stats.freeUnits}
            <span className="ml-1 text-xs font-medium text-muted-foreground">μονάδες</span>
          </>
        }
        sub={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="inline-flex items-center gap-1">
              <Car className="h-3 w-3" />
              {stats.byType.car.free}/{stats.byType.car.total}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bike className="h-3 w-3" />
              {stats.byType.scooter.free}/{stats.byType.scooter.total}
            </span>
            {stats.full.length > 0 && (
              <span className="truncate text-destructive" title={stats.full.join(", ")}>
                Πλήρη: {stats.full.slice(0, 2).join(", ")}
                {stats.full.length > 2 ? ` +${stats.full.length - 2}` : ""}
              </span>
            )}
            {stats.blocked > 0 && <span className="text-muted-foreground">{stats.blocked} εκτός</span>}
          </span>
        }
      />
      <Kpi
        icon={<Clock3 className="h-4 w-4" />}
        tone="text-warning bg-warning/10"
        label="Προς επιβεβαίωση"
        onClick={onPending}
        highlight={stats.pending > 0}
        value={stats.pending}
        sub={stats.pending === 0 ? "Όλες επιβεβαιωμένες" : stats.pendingSoon > 0 ? `${stats.pendingSoon} μέσα στην εβδομάδα` : "Επερχόμενες εκκρεμείς"}
      />
      <Kpi
        icon={<Wallet className="h-4 w-4" />}
        tone="text-accent bg-accent/10"
        label={`Έσοδα ${format(month, "LLLL", { locale: el })}`}
        value={money(stats.revenue)}
        sub={
          <>
            {stats.monthCount} κρατήσεις
            {stats.outstanding > 0 && <span className="text-warning"> · ανεξόφλ. {money(stats.outstanding)}</span>}
          </>
        }
      />
    </div>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  sub,
  onClick,
  highlight,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "min-w-[168px] shrink-0 snap-start rounded-xl border bg-card p-3.5 text-left shadow-sm sm:min-w-0",
        onClick && "transition-colors hover:border-foreground/20 hover:bg-muted/30",
        highlight && "border-warning/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone)}>{icon}</span>
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2.5 text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">{value}</div>
      <div className="mt-2 truncate text-xs text-muted-foreground">{sub}</div>
    </Comp>
  );
}
