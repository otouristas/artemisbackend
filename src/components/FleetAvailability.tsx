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

export function FleetAvailability({ vehicles, bookings }: FleetAvailabilityProps) {
  const today = startOfDay(new Date());

  const groups = useMemo(() => {
    // Group vehicles by base name (without #N)
    const nameMap = new Map<string, { total: number; booked: number; type: string }>();

    for (const v of vehicles) {
      const baseName = v.name.replace(/ #\d+$/, "");
      if (!nameMap.has(baseName)) {
        nameMap.set(baseName, { total: 0, booked: 0, type: v.type });
      }
      const group = nameMap.get(baseName)!;
      group.total++;

      const isBooked = bookings.some((b) => {
        if (b.vehicle_id !== v.id || b.status === "cancelled") return false;
        const checkIn = startOfDay(parseISO(b.check_in));
        const checkOut = startOfDay(parseISO(b.check_out));
        return isWithinInterval(today, { start: checkIn, end: checkOut });
      });
      if (isBooked) group.booked++;
    }

    return Array.from(nameMap.entries()).map(([name, data]) => ({
      name,
      ...data,
      available: data.total - data.booked,
    }));
  }, [vehicles, bookings]);

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {groups.map((g) => {
        const Icon = g.type === "car" ? Car : Bike;
        const allBooked = g.available === 0;
        return (
          <div
            key={g.name}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors",
              allBooked
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-success/10 border-success/20 text-success"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="truncate max-w-[100px]">{g.name}</span>
            <span className={cn(
              "font-bold ml-0.5",
              allBooked ? "text-destructive" : "text-success"
            )}>
              {g.available}/{g.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
