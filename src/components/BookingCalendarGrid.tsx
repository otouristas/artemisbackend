import { useMemo, useState, useCallback } from "react";
import { format, getDaysInMonth, isSameDay, isWithinInterval, parseISO, startOfDay, differenceInDays, addDays } from "date-fns";
import { el } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";

interface BookingCalendarGridProps {
  currentMonth: Date;
  vehicles: Vehicle[];
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
  onCellClick: (vehicleId: string, date: Date) => void;
  onBookingUpdate?: (data: { id: string; check_in: string; check_out: string }) => void;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-success text-success-foreground",
  pending: "bg-warning text-warning-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

export function BookingCalendarGrid({
  currentMonth,
  vehicles,
  bookings,
  onBookingClick,
  onCellClick,
  onBookingUpdate,
}: BookingCalendarGridProps) {
  const isMobile = useIsMobile();
  const daysInMonth = getDaysInMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const [dragBooking, setDragBooking] = useState<{ booking: Booking; dayOffset: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ vehicleId: string; day: number } | null>(null);

  const bookingsByVehicle = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const v of vehicles) {
      map[v.id] = bookings.filter((b) => b.vehicle_id === v.id);
    }
    return map;
  }, [vehicles, bookings]);

  const getBookingForCell = (vehicleId: string, day: number): Booking | undefined => {
    const cellDate = startOfDay(new Date(year, month, day));
    return bookingsByVehicle[vehicleId]?.find((b) => {
      const checkIn = startOfDay(parseISO(b.check_in));
      const checkOut = startOfDay(parseISO(b.check_out));
      return isWithinInterval(cellDate, { start: checkIn, end: checkOut });
    });
  };

  const isCheckIn = (booking: Booking, day: number) =>
    isSameDay(parseISO(booking.check_in), new Date(year, month, day));

  const isCheckOut = (booking: Booking, day: number) =>
    isSameDay(parseISO(booking.check_out), new Date(year, month, day));

  const today = startOfDay(new Date());

  const handleDragStart = useCallback((e: React.DragEvent, booking: Booking, day: number) => {
    const checkInDate = startOfDay(parseISO(booking.check_in));
    const cellDate = startOfDay(new Date(year, month, day));
    const dayOffset = differenceInDays(cellDate, checkInDate);
    setDragBooking({ booking, dayOffset });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", booking.id);
  }, [year, month]);

  const handleDragOver = useCallback((e: React.DragEvent, vehicleId: string, day: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ vehicleId, day });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, vehicleId: string, day: number) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragBooking || !onBookingUpdate) return;

    const { booking, dayOffset } = dragBooking;
    const duration = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
    const newCheckIn = addDays(new Date(year, month, day), -dayOffset);
    const newCheckOut = addDays(newCheckIn, duration);

    onBookingUpdate({
      id: booking.id,
      check_in: format(newCheckIn, "yyyy-MM-dd"),
      check_out: format(newCheckOut, "yyyy-MM-dd"),
    });
    toast.success("Η κράτηση μετακινήθηκε!");
    setDragBooking(null);
  }, [dragBooking, onBookingUpdate, year, month]);

  const handleDragEnd = useCallback(() => {
    setDragBooking(null);
    setDropTarget(null);
  }, []);

  // Responsive sizing
  const vehicleColWidth = isMobile ? 100 : 140;
  const dayColWidth = isMobile ? 32 : 38;
  const cellHeight = isMobile ? 32 : 36;
  const totalWidth = vehicleColWidth + (daysInMonth * dayColWidth);

  return (
    <div className="overflow-x-auto border rounded-lg bg-card -mx-3 sm:mx-0 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="border-collapse" style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px`, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: `${vehicleColWidth}px` }} />
          {days.map((day) => (
            <col key={day} style={{ width: `${dayColWidth}px` }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/50">
            <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 font-semibold text-[10px] sm:text-xs border-r border-b text-left sticky left-0 bg-muted/50 z-20">
              Όχημα
            </th>
            {days.map((day) => {
              const date = new Date(year, month, day);
              const isToday = isSameDay(date, today);
              const dayName = format(date, "EEE", { locale: el });
              const isSunday = date.getDay() === 0;
              return (
                <th
                  key={day}
                  className={cn(
                    "text-center py-1 border-r border-b font-normal",
                    isMobile ? "text-[9px]" : "text-xs",
                    isToday && "bg-primary/10 font-bold",
                    isSunday && "bg-destructive/5"
                  )}
                >
                  <div className="font-medium">{day}</div>
                  <div className={cn("text-muted-foreground", isMobile ? "text-[8px]" : "text-[10px]")}>{dayName}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r sticky left-0 bg-card z-10">
                <div className={cn("font-medium leading-tight truncate", isMobile ? "text-[10px]" : "text-[11px]")}>{vehicle.name}</div>
                <div className={cn("text-muted-foreground", isMobile ? "text-[8px]" : "text-[10px]")}>{vehicle.cc}cc · {vehicle.daily_rate_low}-{vehicle.daily_rate_high}€</div>
              </td>
              {days.map((day) => {
                const booking = getBookingForCell(vehicle.id, day);
                const date = new Date(year, month, day);
                const isToday = isSameDay(date, today);
                const isSunday = date.getDay() === 0;
                const isDropHere = dropTarget?.vehicleId === vehicle.id && dropTarget?.day === day;

                if (booking) {
                  const isStart = isCheckIn(booking, day);
                  const isEnd = isCheckOut(booking, day);
                  return (
                    <td
                      key={day}
                      className={cn(
                        "border-r cursor-pointer relative",
                        isToday && "ring-1 ring-inset ring-primary/30",
                        isSunday && "bg-destructive/5",
                        isDropHere && "bg-primary/20"
                      )}
                      style={{ height: `${cellHeight}px` }}
                      onClick={() => onBookingClick(booking)}
                      onDragOver={(e) => handleDragOver(e, vehicle.id, day)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, vehicle.id, day)}
                      title={`${booking.customer_name} (${booking.status})`}
                    >
                      <div
                        draggable={!isMobile}
                        onDragStart={(e) => handleDragStart(e, booking, day)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "absolute inset-y-0.5 sm:inset-y-1 inset-x-0",
                          STATUS_COLORS[booking.status],
                          "opacity-80 hover:opacity-100 transition-opacity",
                          !isMobile && "cursor-grab active:cursor-grabbing",
                          isStart && "rounded-l-md ml-0.5",
                          isEnd && "rounded-r-md mr-0.5"
                        )}
                      />
                      {isStart && (
                        <span className={cn(
                          "relative z-10 font-semibold truncate px-0.5 flex items-center justify-center h-full pointer-events-none",
                          isMobile ? "text-[7px]" : "text-[9px]"
                        )}>
                          {booking.customer_name.split(" ")[0]}
                        </span>
                      )}
                    </td>
                  );
                }

                return (
                  <td
                    key={day}
                    className={cn(
                      "border-r cursor-pointer hover:bg-primary/5 transition-colors",
                      isToday && "bg-primary/5",
                      isSunday && "bg-destructive/[0.03]",
                      isDropHere && "bg-primary/20"
                    )}
                    style={{ height: `${cellHeight}px` }}
                    onClick={() => onCellClick(vehicle.id, date)}
                    onDragOver={(e) => handleDragOver(e, vehicle.id, day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, vehicle.id, day)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
