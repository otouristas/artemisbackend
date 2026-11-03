import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addMonths, format, isSameMonth, isToday, isWithinInterval, parseISO, startOfDay, startOfMonth, subMonths } from "date-fns";
import { el } from "date-fns/locale";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, List, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { useVehicles } from "@/hooks/useVehicles";
import { useVehicleBlocks } from "@/hooks/useVehicleBlocks";
import { useBookings, useUpdateBooking, useDeleteBooking, type Booking, type BookingInsert } from "@/hooks/useBookings";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookingCalendarGrid } from "@/components/BookingCalendarGrid";
import { BookingListView } from "@/components/BookingListView";
import { BookingPreviewSheet } from "@/components/BookingPreviewSheet";
import { MobileAgendaView } from "@/components/MobileAgendaView";
import { BookingsKpis } from "@/components/bookings/BookingsKpis";
import { exportBookingsCsv, type BookingStatus } from "@/components/bookings/bookingUtils";
import { cn } from "@/lib/utils";

type PipelineFilter = "all" | "pending" | "confirmed" | "in_stay" | "checkout_today" | "cancelled";
type TypeFilter = "all" | "car" | "scooter";
type View = "calendar" | "list";

const PIPELINE_TABS: { key: PipelineFilter; label: string }[] = [
  { key: "all", label: "Όλες" },
  { key: "pending", label: "Εκκρεμείς" },
  { key: "confirmed", label: "Επιβεβαιωμένες" },
  { key: "in_stay", label: "Σε ενοικίαση" },
  { key: "checkout_today", label: "Επιστροφές σήμερα" },
  { key: "cancelled", label: "Ακυρωμένες" },
];

const monthId = (d: Date) => format(d, "yyyy-MM");

function matchesPipeline(b: Booking, p: PipelineFilter, today: Date): boolean {
  switch (p) {
    case "pending":
    case "confirmed":
    case "cancelled":
      return b.status === p;
    case "checkout_today":
      return b.status !== "cancelled" && isToday(parseISO(b.check_out));
    case "in_stay":
      return (
        b.status === "confirmed" &&
        isWithinInterval(today, { start: startOfDay(parseISO(b.check_in)), end: startOfDay(parseISO(b.check_out)) })
      );
    default:
      return true;
  }
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "calendar",
  );
  const [pipeline, setPipeline] = useState<PipelineFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: bookings = [], isLoading: loadingBookings } = useBookings();
  const { data: blocks = [] } = useVehicleBlocks();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const today = useMemo(() => parseISO(todayKey), [todayKey]);
  const isLoading = loadingVehicles || loadingBookings;
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  // Cars first, then scooters, alphabetical inside
  const sortedVehicles = useMemo(
    () =>
      [...vehicles].sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name, "el") : a.type === "car" ? -1 : 1,
      ),
    [vehicles],
  );

  const typeCounts = useMemo(() => {
    const c = { all: 0, car: 0, scooter: 0 };
    for (const v of vehicles) {
      const q = Math.max(1, v.quantity ?? 1);
      c.all += q;
      if (v.type === "car") c.car += q;
      if (v.type === "scooter") c.scooter += q;
    }
    return c;
  }, [vehicles]);

  const scopedVehicles = useMemo(
    () =>
      sortedVehicles.filter(
        (v) => (typeFilter === "all" || v.type === typeFilter) && (modelFilter === "all" || v.id === modelFilter),
      ),
    [sortedVehicles, typeFilter, modelFilter],
  );
  const scopedIds = useMemo(() => new Set(scopedVehicles.map((v) => v.id)), [scopedVehicles]);

  // Bookings limited by type / model / search (before the status pipeline)
  const scopedBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (!scopedIds.has(b.vehicle_id)) return false;
      if (!q) return true;
      const hay = [b.customer_name, b.customer_phone, b.customer_email, b.plate, vehicleMap.get(b.vehicle_id)?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, scopedIds, search, vehicleMap]);

  const pipelineCounts = useMemo(() => {
    const counts = Object.fromEntries(PIPELINE_TABS.map((t) => [t.key, 0])) as Record<PipelineFilter, number>;
    for (const b of scopedBookings) for (const t of PIPELINE_TABS) if (matchesPipeline(b, t.key, today)) counts[t.key]++;
    return counts;
  }, [scopedBookings, today]);

  const filteredBookings = useMemo(
    () => scopedBookings.filter((b) => matchesPipeline(b, pipeline, today)),
    [scopedBookings, pipeline, today],
  );

  // While searching, the timeline only shows models that have a match
  const timelineVehicles = useMemo(() => {
    if (!search.trim()) return scopedVehicles;
    const ids = new Set(filteredBookings.map((b) => b.vehicle_id));
    return scopedVehicles.filter((v) => ids.has(v.id));
  }, [scopedVehicles, filteredBookings, search]);

  // Months that hold bookings → quick jump
  const monthCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of filteredBookings) {
      let m = startOfMonth(parseISO(b.check_in));
      const end = startOfMonth(parseISO(b.check_out));
      let guard = 0;
      while (m <= end && guard++ < 24) {
        const id = monthId(m);
        map.set(id, (map.get(id) ?? 0) + 1);
        m = addMonths(m, 1);
      }
    }
    return map;
  }, [filteredBookings]);

  const monthOptions = useMemo(() => {
    const ids = new Set(monthCounts.keys());
    ids.add(monthId(currentMonth));
    ids.add(monthId(today));
    return [...ids].sort();
  }, [monthCounts, currentMonth, today]);

  const currentId = monthId(currentMonth);
  const currentCount = monthCounts.get(currentId) ?? 0;
  const withBookings = [...monthCounts.keys()].sort();
  const nextMonthWith = withBookings.find((id) => id > currentId);
  const prevMonthWith = [...withBookings].reverse().find((id) => id < currentId);

  // First load: if this month is empty, open the nearest month that has bookings
  const autoJumped = useRef(false);
  useEffect(() => {
    if (autoJumped.current || isLoading || bookings.length === 0) return;
    autoJumped.current = true;
    const live = bookings.filter((b) => b.status !== "cancelled");
    const nowId = monthId(new Date());
    const hasNow = live.some((b) => monthId(parseISO(b.check_in)) <= nowId && monthId(parseISO(b.check_out)) >= nowId);
    if (hasNow) return;
    const ids = [...new Set(live.map((b) => monthId(parseISO(b.check_in))))].sort();
    const target = ids.find((id) => id > nowId) ?? ids[ids.length - 1];
    if (target) setCurrentMonth(parseISO(`${target}-01`));
  }, [isLoading, bookings]);

  const goToMonth = (id: string) => setCurrentMonth(parseISO(`${id}-01`));
  const monthLabel = (id: string) => format(parseISO(`${id}-01`), "LLLL yyyy", { locale: el });

  // ── Mutations ──────────────────────────────────────────
  const handleUpdate = (data: { id: string } & Partial<BookingInsert>, success = "Η κράτηση ενημερώθηκε") => {
    updateBooking.mutate(data, {
      onSuccess: () => toast.success(success),
      onError: () => toast.error("Σφάλμα κατά την ενημέρωση"),
    });
  };

  const handleStatus = (b: Booking, status: BookingStatus) => {
    handleUpdate(
      { id: b.id, status },
      status === "confirmed" ? "Η κράτηση επιβεβαιώθηκε" : status === "cancelled" ? "Η κράτηση ακυρώθηκε" : "Η κράτηση ενημερώθηκε",
    );
    setPreview((p) => (p && p.id === b.id ? { ...p, status } : p));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    deleteBooking.mutate(id, {
      onSuccess: () => toast.success("Η κράτηση διαγράφηκε"),
      onError: () => toast.error("Σφάλμα κατά τη διαγραφή"),
    });
    setDeleteTarget(null);
    setPreview((p) => (p?.id === id ? null : p));
  };

  const exportCsv = () => {
    exportBookingsCsv(filteredBookings, vehicles);
    toast.success(`Εξήχθησαν ${filteredBookings.length} κρατήσεις σε CSV`);
  };

  const editBooking = (b: Booking) => navigate(`/booking/${b.id}`);
  const showMonthNav = view === "calendar";
  const filtersActive = typeFilter !== "all" || modelFilter !== "all" || search.trim() !== "" || pipeline !== "all";

  const resetFilters = () => {
    setTypeFilter("all");
    setModelFilter("all");
    setSearch("");
    setPipeline("all");
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="w-full px-3 py-4 sm:px-6 md:py-6 lg:px-8">
      <PageHeader
        title="Κρατήσεις"
        subtitle={`${bookings.length} κρατήσεις · ${typeCounts.all} μονάδες στόλου`}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as View)} className="hidden sm:block">
              <TabsList className="segmented">
                <TabsTrigger value="calendar" className="segmented-item gap-1.5 px-3">
                  <CalendarRange className="h-4 w-4" />
                  Χρονοδιάγραμμα
                </TabsTrigger>
                <TabsTrigger value="list" className="segmented-item gap-1.5 px-3">
                  <List className="h-4 w-4" />
                  Λίστα
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" className="hidden gap-1.5 sm:inline-flex" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button className="gap-1.5" onClick={() => navigate("/booking/new")}>
              <Plus className="h-4 w-4" />
              Νέα κράτηση
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-[480px] w-full rounded-xl" />
        </div>
      ) : (
        <>
          <BookingsKpis
            vehicles={vehicles}
            bookings={bookings}
            blocks={blocks}
            month={currentMonth}
            onPending={() => {
              setPipeline("pending");
              setView("list");
            }}
            onInStay={() => setPipeline("in_stay")}
          />

          {/* ── Toolbar ── */}
          <div className="mb-4 rounded-xl border bg-card shadow-sm">
            <div
              role="tablist"
              aria-label="Κατάσταση κράτησης"
              className="flex gap-1 overflow-x-auto border-b px-2 [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden"
            >
              {PIPELINE_TABS.map((t) => {
                const active = pipeline === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPipeline(t.key)}
                    className={cn(
                      "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-3 text-[13px] font-medium transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {pipelineCounts[t.key]}
                    </span>
                    {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2.5 p-2.5 sm:p-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Πελάτης, τηλέφωνο, πινακίδα…"
                  className="h-10 pl-9 pr-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    aria-label="Καθαρισμός"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Tabs
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v as TypeFilter);
                    setModelFilter("all");
                  }}
                  className="shrink-0"
                >
                  <TabsList className="segmented grid h-10 w-full grid-cols-3 sm:inline-flex sm:w-auto">
                    <TabsTrigger value="all" className="segmented-item px-3 text-xs sm:text-sm">
                      Όλα
                    </TabsTrigger>
                    <TabsTrigger value="car" className="segmented-item gap-1 px-3 text-xs sm:text-sm">
                      Αυτοκίνητα <span className="tabular-nums text-muted-foreground">{typeCounts.car}</span>
                    </TabsTrigger>
                    <TabsTrigger value="scooter" className="segmented-item gap-1 px-3 text-xs sm:text-sm">
                      Scooter <span className="tabular-nums text-muted-foreground">{typeCounts.scooter}</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Select value={modelFilter} onValueChange={setModelFilter}>
                  <SelectTrigger className="h-10 w-full min-w-0 sm:w-56">
                    <SelectValue placeholder="Όλα τα μοντέλα" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Όλα τα μοντέλα</SelectItem>
                    {sortedVehicles
                      .filter((v) => typeFilter === "all" || v.type === typeFilter)
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {(v.quantity ?? 1) > 1 ? ` ×${v.quantity}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {filtersActive && (
                <Button variant="ghost" size="sm" className="h-10 self-start text-muted-foreground lg:self-auto" onClick={resetFilters}>
                  Καθαρισμός
                </Button>
              )}

              {showMonthNav && (
                <div className="flex items-center gap-1.5 lg:ml-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                    aria-label="Προηγούμενος μήνας"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select value={currentId} onValueChange={goToMonth}>
                    <SelectTrigger className="h-10 min-w-0 flex-1 font-semibold capitalize lg:w-52 lg:flex-none">
                      <SelectValue>
                        <span className="capitalize sm:hidden">
                          {format(currentMonth, "LLL yyyy", { locale: el })}
                        </span>
                        <span className="hidden capitalize sm:inline">{monthLabel(currentId)}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((id) => (
                        <SelectItem key={id} value={id}>
                          <span className="flex w-full items-center justify-between gap-6">
                            <span className="capitalize">{monthLabel(id)}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{monthCounts.get(id) ?? 0}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                    aria-label="Επόμενος μήνας"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isSameMonth(currentMonth, today) ? "secondary" : "outline"}
                    className="h-10 shrink-0"
                    onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                  >
                    Σήμερα
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: list vs day agenda */}
          {isMobile && (
            <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mb-3">
              <TabsList className="segmented grid w-full grid-cols-2">
                <TabsTrigger value="list" className="segmented-item gap-1.5">
                  <List className="h-4 w-4" />
                  Λίστα
                </TabsTrigger>
                <TabsTrigger value="calendar" className="segmented-item gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  Ημέρες
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Empty month notice with quick jumps */}
          {showMonthNav && currentCount === 0 && (nextMonthWith || prevMonthWith) && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm sm:flex-row sm:items-center">
              <span className="text-muted-foreground">
                Καμία κράτηση τον <span className="font-medium capitalize text-foreground">{monthLabel(currentId)}</span>.
              </span>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {prevMonthWith && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => goToMonth(prevMonthWith)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="capitalize">{monthLabel(prevMonthWith)}</span>
                    <span className="text-muted-foreground">· {monthCounts.get(prevMonthWith)}</span>
                  </Button>
                )}
                {nextMonthWith && (
                  <Button size="sm" className="gap-1" onClick={() => goToMonth(nextMonthWith)}>
                    <span className="capitalize">{monthLabel(nextMonthWith)}</span>
                    <span className="opacity-75">· {monthCounts.get(nextMonthWith)}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {view === "calendar" && isMobile ? (
            <MobileAgendaView
              currentMonth={currentMonth}
              bookings={filteredBookings}
              vehicles={scopedVehicles}
              onBookingClick={setPreview}
            />
          ) : view === "calendar" ? (
            <BookingCalendarGrid
              currentMonth={currentMonth}
              vehicles={timelineVehicles}
              bookings={filteredBookings}
              blocks={blocks}
              onBookingClick={setPreview}
              onCellClick={(vehicleId, date) => {
                const params = new URLSearchParams();
                params.set("vehicleId", vehicleId);
                params.set("date", format(date, "yyyy-MM-dd"));
                navigate(`/booking/new?${params}`);
              }}
              onBookingUpdate={(data) => handleUpdate(data, "Η κράτηση μετακινήθηκε")}
            />
          ) : (
            <BookingListView
              bookings={filteredBookings}
              vehicles={vehicles}
              onOpen={setPreview}
              onEdit={editBooking}
              onDelete={setDeleteTarget}
            />
          )}

          {isMobile && (
            <Button variant="outline" className="mt-4 w-full gap-1.5" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Εξαγωγή CSV ({filteredBookings.length})
            </Button>
          )}
        </>
      )}

      <BookingPreviewSheet
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
        booking={preview}
        vehicle={preview ? vehicleMap.get(preview.vehicle_id) : undefined}
        onEdit={() => {
          if (!preview) return;
          const b = preview;
          setPreview(null);
          editBooking(b);
        }}
        onStatusChange={(status) => preview && handleStatus(preview, status)}
        onDelete={() => preview && setDeleteTarget(preview)}
      />

      <ConfirmSheet
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Διαγραφή κράτησης"
        description={`Διαγραφή της κράτησης του ${deleteTarget?.customer_name ?? ""}${
          deleteTarget && vehicleMap.get(deleteTarget.vehicle_id) ? ` (${vehicleMap.get(deleteTarget.vehicle_id)?.name})` : ""
        }; Η ενέργεια δεν αναιρείται.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
