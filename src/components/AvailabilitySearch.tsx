import { useState, useMemo } from "react";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import { el } from "date-fns/locale";
import { CalendarSearch, CalendarIcon, CheckCircle2, XCircle, Bike, Car, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";

interface AvailabilitySearchProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
  onNewBooking: (vehicleId: string, date: Date) => void;
}

function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  // Two ranges overlap if one starts before the other ends
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart);
}

export function AvailabilitySearch({
  vehicles,
  bookings,
  onBookingClick,
  onNewBooking,
}: AvailabilitySearchProps) {
  const [open, setOpen] = useState(false);
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();

  const results = useMemo(() => {
    if (!checkIn || !checkOut) return null;

    return vehicles.map((vehicle) => {
      const conflictingBookings = bookings.filter((b) => {
        if (b.vehicle_id !== vehicle.id || b.status === "cancelled") return false;
        const bStart = parseISO(b.check_in);
        const bEnd = parseISO(b.check_out);
        return datesOverlap(checkIn, checkOut, bStart, bEnd);
      });

      return {
        vehicle,
        available: conflictingBookings.length === 0,
        conflictingBookings,
      };
    });
  }, [checkIn, checkOut, vehicles, bookings]);

  const availableCount = results?.filter((r) => r.available).length ?? 0;
  const totalCount = results?.length ?? 0;

  const handleCheckInSelect = (date: Date | undefined) => {
    setCheckIn(date);
    if (date && checkOut && !isBefore(date, checkOut)) {
      setCheckOut(undefined);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(true)}
        title="Έλεγχος διαθεσιμότητας"
      >
        <CalendarSearch className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarSearch className="h-5 w-5" />
              Έλεγχος Διαθεσιμότητας
            </DialogTitle>
          </DialogHeader>

          {/* Date pickers */}
          <div className="flex gap-2">
            {/* Check-in */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !checkIn && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkIn ? format(checkIn, "d MMM", { locale: el }) : "Άφιξη"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkIn}
                  onSelect={handleCheckInSelect}
                  locale={el}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <ChevronRight className="h-4 w-4 self-center text-muted-foreground shrink-0" />

            {/* Check-out */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !checkOut && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkOut ? format(checkOut, "d MMM", { locale: el }) : "Αναχώρηση"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkOut}
                  onSelect={setCheckOut}
                  locale={el}
                  disabled={(date) => (checkIn ? !isAfter(date, checkIn) : false)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Results */}
          {results ? (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {format(checkIn!, "d MMM", { locale: el })} →{" "}
                  {format(checkOut!, "d MMM yyyy", { locale: el })}
                </span>
                <Badge
                  variant={availableCount > 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {availableCount}/{totalCount} διαθέσιμα
                </Badge>
              </div>

              {/* Vehicle list */}
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {results.map(({ vehicle, available, conflictingBookings }) => {
                  const Icon = vehicle.type === "car" ? Car : Bike;
                  return (
                    <div
                      key={vehicle.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        available
                          ? "bg-success/5 border-success/20"
                          : "bg-destructive/5 border-destructive/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {available ? (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{vehicle.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {vehicle.cc}cc
                          </span>
                        </div>
                        {available ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs shrink-0 border-success/30 text-success hover:bg-success/10"
                            onClick={() => {
                              onNewBooking(vehicle.id, checkIn!);
                              setOpen(false);
                            }}
                          >
                            + Κράτηση
                          </Button>
                        ) : (
                          <span className="text-xs text-destructive font-medium shrink-0">
                            Μη διαθέσιμο
                          </span>
                        )}
                      </div>

                      {/* Conflicting bookings */}
                      {conflictingBookings.length > 0 && (
                        <div className="mt-2 space-y-1 pl-6">
                          {conflictingBookings.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => {
                                onBookingClick(b);
                                setOpen(false);
                              }}
                              className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-0.5"
                            >
                              <span className="font-medium text-foreground/80">
                                {b.customer_name}
                              </span>
                              <span>·</span>
                              <span>
                                {format(parseISO(b.check_in), "d MMM", { locale: el })} –{" "}
                                {format(parseISO(b.check_out), "d MMM", { locale: el })}
                              </span>
                              <Badge
                                variant={
                                  b.status === "confirmed"
                                    ? "default"
                                    : b.status === "pending"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-[10px] h-4 px-1 ml-auto"
                              >
                                {b.status === "confirmed"
                                  ? "Επιβ."
                                  : b.status === "pending"
                                  ? "Εκκρ."
                                  : "Ακυρ."}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Επιλέξτε ημερομηνίες για να δείτε τη διαθεσιμότητα
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
