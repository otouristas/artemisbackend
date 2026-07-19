import { useState } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { el } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List, BarChart3, Users, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useVehicles } from "@/hooks/useVehicles";
import { useBookings, useCreateBooking, useUpdateBooking, useDeleteBooking } from "@/hooks/useBookings";
import { BookingCalendarGrid } from "@/components/BookingCalendarGrid";
import { BookingListView } from "@/components/BookingListView";
import { TodayWidgets } from "@/components/TodayWidgets";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { ClientsView } from "@/components/ClientsView";
import { FleetAvailability } from "@/components/FleetAvailability";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QuickSearch } from "@/components/QuickSearch";
import { AvailabilitySearch } from "@/components/AvailabilitySearch";
import { useAuth } from "@/hooks/useAuth";
import type { Booking, BookingInsert } from "@/hooks/useBookings";
import logoImg from "@/assets/logo.svg";

type View = "calendar" | "list" | "analytics" | "clients";

const Index = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<View>("calendar");
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: bookings = [], isLoading: loadingBookings } = useBookings();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();

  const handleCreate = (data: BookingInsert) => {
    createBooking.mutate(data, {
      onSuccess: () => toast.success("Η κράτηση δημιουργήθηκε!"),
      onError: () => toast.error("Σφάλμα κατά τη δημιουργία"),
    });
  };

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

  const openNewBooking = (vehicleId?: string, date?: Date) => {
    const params = new URLSearchParams();
    if (vehicleId) params.append("vehicleId", vehicleId);
    if (date) params.append("date", format(date, "yyyy-MM-dd"));
    navigate(`/booking/new?${params.toString()}`);
  };

  const openEditBooking = (booking: Booking) => {
    navigate(`/booking/${booking.id}`);
  };

  const isLoading = loadingVehicles || loadingBookings;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="border-b bg-card px-4 sm:px-6 py-2 md:py-3">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <img src={logoImg} alt="Artemis Rental" className="h-8 md:h-10 object-contain" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm md:text-xl font-bold text-foreground tracking-tight truncate">
              Artemis Rental
            </h1>
            <p className="text-[10px] md:text-sm text-muted-foreground">
              Σίφνος · Διαχείριση κρατήσεων · {vehicles.length} οχήματα
             </p>
           </div>
           <div className="flex items-center gap-1">
             <AvailabilitySearch
               vehicles={vehicles}
               bookings={bookings}
               onBookingClick={openEditBooking}
               onNewBooking={(vehicleId, date) => openNewBooking(vehicleId, date)}
             />
             <QuickSearch bookings={bookings} vehicles={vehicles} onBookingClick={openEditBooking} />
             <ThemeToggle />
             <Button
               variant="ghost"
               size="icon"
               className="h-8 w-8"
               onClick={() => void signOut()}
               title="Αποσύνδεση"
             >
               <LogOut className="h-4 w-4" />
             </Button>
             <Button onClick={() => openNewBooking()} size="sm" className="gap-1.5 hidden md:inline-flex">
               <Plus className="h-4 w-4" />
               Νέα κράτηση
             </Button>
           </div>
         </div>
       </header>

      {/* Controls */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2 md:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 md:mb-4">
          {/* Month navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7 md:h-9 md:w-9" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[120px] md:min-w-[180px] text-center font-semibold text-xs md:text-lg capitalize">
              {format(currentMonth, "LLLL yyyy", { locale: el })}
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7 md:h-9 md:w-9" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="text-[10px] md:text-xs h-7">
              Σήμερα
            </Button>
          </div>

          {/* Desktop view toggle */}
          <Tabs value={view} onValueChange={(v) => setView(v as View)} className="hidden md:block">
            <TabsList>
              <TabsTrigger value="calendar" className="gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Ημερολόγιο
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="h-4 w-4" />
                Λίστα
              </TabsTrigger>
              <TabsTrigger value="clients" className="gap-1.5">
                <Users className="h-4 w-4" />
                Πελάτες
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Στατιστικά
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Fleet availability badges */}
        {!isLoading && (view === "calendar" || view === "list") && (
          <FleetAvailability vehicles={vehicles} bookings={bookings} />
        )}

        {/* Today's widgets */}
        {!isLoading && (view === "calendar" || view === "list") && (
          <TodayWidgets
            bookings={bookings}
            vehicles={vehicles}
            onBookingClick={openEditBooking}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Φόρτωση...</div>
        ) : view === "calendar" ? (
          <BookingCalendarGrid
            currentMonth={currentMonth}
            vehicles={vehicles}
            bookings={bookings}
            onBookingClick={openEditBooking}
            onCellClick={(vehicleId, date) => openNewBooking(vehicleId, date)}
            onBookingUpdate={(data) => handleUpdate(data as any)}
          />
        ) : view === "list" ? (
          <BookingListView
            bookings={bookings}
            vehicles={vehicles}
            onEdit={openEditBooking}
            onDelete={handleDelete}
            filterVehicle={filterVehicle}
            onFilterVehicleChange={setFilterVehicle}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
          />
        ) : view === "clients" ? (
          <ClientsView
            bookings={bookings}
            vehicles={vehicles}
            onBookingClick={openEditBooking}
          />
        ) : (
          <AnalyticsDashboard
            bookings={bookings}
            vehicles={vehicles}
            currentMonth={currentMonth}
          />
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav
        view={view}
        onViewChange={setView}
        onNewBooking={() => openNewBooking()}
      />
    </div>
  );
};

export default Index;
