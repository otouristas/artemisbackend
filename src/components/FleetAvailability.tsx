import { useMemo } from "react";
import { isWithinInterval, parseISO, startOfDay } from "date-fns";
import { Bike, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";

interface FleetAvailabilityProps {
  vehicles: Vehicle[];
  bookings: Booking[];
}

/** Today's free units per model, as a scrollable strip of photo chips. */
export function FleetAvailability({ vehicles, bookings }: FleetAvailabilityProps) {
  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    // One row per model; legacy "#N" rows of the same model are folded together.
    const map = new Map<string, { name: string; type: string; image: string | null; total: number; booked: number }>();
    for (const v of vehicles) {
      const baseName = v.name.replace(/ #\d+$/, "");
      const g = map.get(baseName) ?? { name: baseName, type: v.type, image: v.image_url, total: 0, booked: 0 };
      const units = v.quantity ?? 1;
      const onRent = bookings.filter((b) => {
        if (b.vehicle_id !== v.id || b.status === "cancelled") return false;
        return isWithinInterval(today, {
          start: startOfDay(parseISO(b.check_in)),
          end: startOfDay(parseISO(b.check_out)),
        });
      }).length;
      g.total += units;
      g.booked += Math.min(units, onRent);
      g.image = g.image ?? v.image_url;
      map.set(baseName, g);
    }
    return [...map.values()].map((g) => ({ ...g, available: g.total - g.booked }));
  }, [vehicles, bookings]);

  if (groups.length === 0) return null;

  return (
    <div className="-mx-3 mb-4 flex flex-nowrap gap-2 overflow-x-auto px-3 pb-1 scrollbar-none scroll-fade-x">
      {groups.map((g) => {
        const Icon = g.type === "car" ? Car : Bike;
        const full = g.available === 0;
        const pct = g.total ? (g.available / g.total) * 100 : 0;
        return (
          <div
            key={g.name}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl border bg-card py-1.5 pl-1.5 pr-3 shadow-sm",
              full && "border-destructive/25 bg-destructive/5",
            )}
          >
            <div className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {g.image ? (
                <img src={g.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="max-w-[120px] truncate text-xs font-semibold leading-tight">{g.name}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1 w-10 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", full ? "bg-destructive" : "bg-success")}
                    style={{ width: `${full ? 100 : pct}%` }}
                  />
                </span>
                <span className={cn("text-[11px] font-bold tabular-nums leading-none", full ? "text-destructive" : "text-success")}>
                  {g.available}/{g.total}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
