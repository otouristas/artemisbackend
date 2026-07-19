import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addMonths, subMonths, parseISO, isToday, isWithinInterval, startOfDay } from "date-fns";
import { el } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List, Car, Bike, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useVehicles } from "@/hooks/useVehicles";
import { useBookings, useUpdateBooking, useDeleteBooking, type Booking, type BookingInsert } from "@/hooks/useBookings";
import { BookingCalendarGrid } from "@/components/BookingCalendarGrid";
import { BookingListView } from "@/components/BookingListView";
import { FleetAvailability } from "@/components/FleetAvailability";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type PipelineFilter = "all" | "pending" | "confirmed" | "in_stay" | "checkout_today" | "cancelled";

export default function BookingsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"calendar" | "list">(isMobile ? "list" : "calendar");
  const [pipeline, setPipeline] = useState<PipelineFilter>("all");
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "car" | "scooter">("all");

  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: bookings = [], isLoading: loadingBookings } = useBookings();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();

  const today = startOfDay(new Date());

  const filteredVehicles = useMemo(() => {
    if (vehicleTypeFilter === "all") return vehicles;
    return vehicles.filter((v) => v.type === vehicleTypeFilter);
  }, [vehicles, vehicleTypeFilter]);

  const vehicleTypeCounts = useMemo(() => {
    const counts = { all: vehicles.length, car: 0, scooter: 0 };
    for (const v of vehicles) {
      if (v.type === "car") counts.car++;
      if (v.type === "scooter") counts.scooter++;
    }
    return counts;
  }, [vehicles]);

  const pipelineCounts = useMemo(() => {
    const counts = {
      all: bookings.length,
      pending: 0,
      confirmed: 0,
      in_stay: 0,
      checkout_today: 0,
      cancelled: 0,
    };
    for (const b of bookings) {
      if (b.status === "cancelled") {
        counts.cancelled++;
        continue;
      }
      if (b.status === "pending") counts.pending++;
      if (b.status === "confirmed") counts.confirmed++;
      const checkIn = startOfDay(parseISO(b.check_in));
      const checkOut = startOfDay(parseISO(b.check_out));
      if (isToday(checkOut)) counts.checkout_today++;
      if (isWithinInterval(today, { start: checkIn, end: checkOut }) && b.status !== "pending") {
        counts.in_stay++;
      }
    }
    return counts;
  }, [bookings, today]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (pipeline === "all") return true;
      if (pipeline === "pending") return b.status === "pending";
      if (pipeline === "confirmed") return b.status === "confirmed";
      if (pipeline === "cancelled") return b.status === "cancelled";
      if (pipeline === "checkout_today") return b.status !== "cancelled" && isToday(parseISO(b.check_out));
      if (pipeline === "in_stay") {
        if (b.status === "cancelled" || b.status === "pending") return false;
        return isWithinInterval(today, {
          start: startOfDay(parseISO(b.check_in)),
          end: startOfDay(parseISO(b.check_out)),
        });
      }
      return true;
    });
  }, [bookings, pipeline, today]);

  const handleUpdate = (data: { id: string } & Partial<BookingInsert>) => {
    updateBooking.mutate(data, {
      onSuccess: () => toast.success("Η κράτηση ενημερώθηκε!"),
      onError: () => toast.error("Σφάλμα κατά την ενημέρωση"),
    });
  };

  const handleDelete = (id: string) => {
    deleteBooking.mutate(id, {
      onSuccess: () => toast.success("Η κράτηση διαγράφηκε!"),
      onError: () => toast.error("Σφάλμα κατά τη διαγραφή"),
    });
  };

  const isLoading = loadingVehicles || loadingBookings;

  const pipelineTabs: { key: PipelineFilter; label: string }[] = [
    { key: "all", label: "Όλες" },
    { key: "pending", label: "Εκκρεμείς" },
    { key: "confirmed", label: "Επιβεβ." },
    { key: "in_stay", label: "Σε ενοικίαση" },
    { key: "checkout_today", label: "Checkout" },
    { key: "cancelled", label: "Ακυρωμένες" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 md:py-6">
      <PageHeader
        title="Κρατήσεις"
        subtitle={`${bookings.length} συνολικά · ${format(currentMonth, "LLLL yyyy", { locale: el })}`}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as "calendar" | "list")} className="hidden sm:block">
              <TabsList>
                <TabsTrigger value="calendar" className="gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  Ημερολόγιο
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5">
                  <List className="h-4 w-4" />
                  Λίστα
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => navigate("/booking/new")}>
              <Plus className="h-4 w-4" />
              Νέα
            </Button>
          </>
        }
      />

      {/* Pipeline Booking Status Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none -mx-3 px-3 scroll-fade-x flex-nowrap">
        {pipelineTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setPipeline(tab.key);
              if (tab.key === "pending" || tab.key === "confirmed" || tab.key === "cancelled") {
                setFilterStatus(tab.key);
              } else {
                setFilterStatus("all");
              }
            }}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.95]",
              pipeline === tab.key
                ? "bg-accent text-accent-foreground border-accent shadow-sm"
                : "bg-card/70 backdrop-blur-md text-muted-foreground border-border/40 hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="ml-1.5 opacity-75 bg-muted-foreground/10 px-1.5 py-0.5 rounded-full text-[10px]">
              {pipelineCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Vehicle Type Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none -mx-3 px-3 scroll-fade-x flex-nowrap">
        {[
          { key: "all", label: "Όλα οχήματα", icon: LayoutGrid, count: vehicleTypeCounts.all },
          { key: "car", label: "Αυτοκίνητα", icon: Car, count: vehicleTypeCounts.car },
          { key: "scooter", label: "Scooters", icon: Bike, count: vehicleTypeCounts.scooter },
        ].map((type) => {
          const Icon = type.icon;
          const active = vehicleTypeFilter === type.key;
          return (
            <button
              key={type.key}
              onClick={() => setVehicleTypeFilter(type.key as any)}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.95]",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card/70 backdrop-blur-md text-muted-foreground border-border/40 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {type.label}
              <span className="opacity-75 bg-muted-foreground/10 px-1.5 py-0.5 rounded-full text-[10px]">
                {type.count}
              </span>
            </button>
          );
        })}
      </div>

      {(view === "calendar" || !isMobile) && (
        <div className="flex items-center gap-1 mb-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[140px] text-center font-semibold text-sm capitalize">
            {format(currentMonth, "LLLL yyyy", { locale: el })}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setCurrentMonth(new Date())}>
            Σήμερα
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {(view === "calendar" || view === "list") && (
            <FleetAvailability vehicles={filteredVehicles} bookings={filteredBookings} />
          )}

          {view === "calendar" && !isMobile ? (
            <BookingCalendarGrid
              currentMonth={currentMonth}
              vehicles={filteredVehicles}
              bookings={filteredBookings}
              onBookingClick={(b: Booking) => navigate(`/booking/${b.id}`)}
              onCellClick={(vehicleId, date) => {
                const params = new URLSearchParams();
                params.set("vehicleId", vehicleId);
                params.set("date", format(date, "yyyy-MM-dd"));
                navigate(`/booking/new?${params}`);
              }}
              onBookingUpdate={(data) => handleUpdate(data as any)}
            />
          ) : (
            <BookingListView
              bookings={filteredBookings}
              vehicles={filteredVehicles}
              onEdit={(b) => navigate(`/booking/${b.id}`)}
              onDelete={handleDelete}
              filterVehicle={filterVehicle}
              onFilterVehicleChange={setFilterVehicle}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
            />
          )}

          {isMobile && (
            <div className="fixed bottom-24 right-4 z-40 sm:hidden">
              <Button
                size="sm"
                variant="outline"
                className="bg-card shadow"
                onClick={() => setView(view === "list" ? "calendar" : "list")}
              >
                {view === "list" ? <CalendarDays className="h-4 w-4 mr-1" /> : <List className="h-4 w-4 mr-1" />}
                {view === "list" ? "Ημερολόγιο" : "Λίστα"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
