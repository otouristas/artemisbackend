import { useMemo } from "react";
import { format, parseISO, isToday } from "date-fns";
import { el } from "date-fns/locale";
import { LogIn, LogOut, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";

interface TodayWidgetsProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onBookingClick: (booking: Booking) => void;
}

const STATUS_VARIANT: Record<string, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export function TodayWidgets({ bookings, vehicles, onBookingClick }: TodayWidgetsProps) {
  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const todayArrivals = useMemo(
    () => bookings.filter((b) => isToday(parseISO(b.check_in)) && b.status !== "cancelled"),
    [bookings]
  );

  const todayDepartures = useMemo(
    () => bookings.filter((b) => isToday(parseISO(b.check_out)) && b.status !== "cancelled"),
    [bookings]
  );

  if (todayArrivals.length === 0 && todayDepartures.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {todayArrivals.length > 0 && (
        <Card className="border-success/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-success">
              <LogIn className="h-4 w-4" />
              Σημερινές Αφίξεις ({todayArrivals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {todayArrivals.map((b) => (
              <div
                key={b.id}
                onClick={() => onBookingClick(b)}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{b.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{vehicleMap[b.vehicle_id]?.name}</div>
                </div>
                <Badge className={cn("text-[10px]", STATUS_VARIANT[b.status])}>
                  {b.status === "confirmed" ? "✓" : "⏳"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {todayDepartures.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-warning">
              <LogOut className="h-4 w-4" />
              Σημερινές Αναχωρήσεις ({todayDepartures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {todayDepartures.map((b) => (
              <div
                key={b.id}
                onClick={() => onBookingClick(b)}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{b.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{vehicleMap[b.vehicle_id]?.name}</div>
                </div>
                <Badge className={cn("text-[10px]", STATUS_VARIANT[b.status])}>
                  {b.status === "confirmed" ? "✓" : "⏳"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
