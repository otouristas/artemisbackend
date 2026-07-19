import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format, differenceInDays, parseISO, isBefore, isAfter } from "date-fns";
import { el } from "date-fns/locale";
import { CalendarIcon, MessageCircle, Sparkles, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { VehicleChecklist } from "@/components/VehicleChecklist";
import { BookingReceipt } from "@/components/BookingReceipt";
import { useVehicles } from "@/hooks/useVehicles";
import { useBookings, useCreateBooking, useUpdateBooking, useDeleteBooking } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { STATUS_LABELS, SOURCE_LABELS } from "@/lib/status";
import { Skeleton } from "@/components/ui/skeleton";

function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart);
}

export default function BookingFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: bookings = [], isLoading: loadingBookings } = useBookings();
  const { data: clients = [] } = useClients();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();

  const editBooking = useMemo(() => {
    if (!id) return null;
    return bookings.find((b) => b.id === id) || null;
  }, [id, bookings]);

  const defaultVehicleId = searchParams.get("vehicleId") || undefined;
  const defaultClientId = searchParams.get("clientId") || undefined;
  const defaultDateStr = searchParams.get("date");
  const defaultDate = useMemo(() => {
    return defaultDateStr ? parseISO(defaultDateStr) : new Date();
  }, [defaultDateStr]);

  const [clientId, setClientId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [assignedPlate, setAssignedPlate] = useState("");
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [comments, setComments] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [status, setStatus] = useState<"pending" | "confirmed" | "cancelled">("pending");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const [bookingSource, setBookingSource] = useState("phone");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggested_total: number; daily_rate: number; explanation: string } | null>(null);

  // Conflict detection state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Tracks if the component has initialized fields from editBooking/params
  const [isInitialized, setIsInitialized] = useState(false);

  const isLoading = loadingVehicles || loadingBookings;

  useEffect(() => {
    if (isLoading) return;
    if (isInitialized) return;

    if (editBooking) {
      setClientId(editBooking.client_id);
      setCustomerName(editBooking.customer_name);
      setCustomerPhone(editBooking.customer_phone || "");
      setCustomerEmail(editBooking.customer_email || "");
      setVehicleId(editBooking.vehicle_id);
      setAssignedPlate(editBooking.plate || "");
      setCheckIn(new Date(editBooking.check_in));
      setCheckOut(new Date(editBooking.check_out));
      setComments(editBooking.comments || "");
      setPaymentNotes(editBooking.payment_notes || "");
      setStatus(editBooking.status);
      setDeliveryLocation(editBooking.delivery_location || "");
      setDepositAmount(String(editBooking.deposit_amount || ""));
      setTotalPrice(String(editBooking.total_price || ""));
      setIdDocument(editBooking.id_document || "");
      setBookingSource(editBooking.booking_source || "phone");
    } else {
      const fromClient = defaultClientId
        ? clients.find((c) => c.id === defaultClientId)
        : undefined;
      setClientId(fromClient?.id ?? null);
      setCustomerName(fromClient?.name ?? "");
      setCustomerPhone(fromClient?.phone ?? "");
      setCustomerEmail(fromClient?.email ?? "");
      setVehicleId(defaultVehicleId || fromClient?.preferred_vehicle_id || "");
      setAssignedPlate("");
      setCheckIn(defaultDate);
      setCheckOut(undefined);
      setComments("");
      setPaymentNotes("");
      setStatus("pending");
      setDeliveryLocation("");
      setDepositAmount("");
      setTotalPrice("");
      setIdDocument(fromClient?.id_document ?? "");
      setBookingSource("phone");
      setIsDuplicate(false);
    }
    setIsInitialized(true);
  }, [editBooking, defaultVehicleId, defaultClientId, defaultDate, isLoading, isInitialized, clients]);

  // Compute conflicting bookings for the selected vehicle + dates
  const conflictingBookings = useMemo(() => {
    if (!vehicleId || !checkIn || !checkOut) return [];
    const isEditing = editBooking && !isDuplicate;

    return bookings.filter((b) => {
      if (b.vehicle_id !== vehicleId) return false;
      if (b.status === "cancelled") return false;
      // Exclude the booking being edited
      if (isEditing && b.id === editBooking.id) return false;
      const bStart = parseISO(b.check_in);
      const bEnd = parseISO(b.check_out);
      return datesOverlap(checkIn, checkOut, bStart, bEnd);
    });
  }, [vehicleId, checkIn, checkOut, bookings, editBooking, isDuplicate]);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  // Individual unit plates of the selected fleet type (comma-separated in vehicles.plate)
  const vehiclePlates = useMemo(
    () => (selectedVehicle?.plate ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [selectedVehicle],
  );

  // Plates already assigned to overlapping bookings for the chosen dates
  const takenPlates = useMemo(() => {
    const set = new Set<string>();
    for (const b of conflictingBookings) {
      if (b.plate) set.add(b.plate);
    }
    return set;
  }, [conflictingBookings]);

  const fleetQuantity = selectedVehicle?.quantity ?? 1;
  const freeUnits = Math.max(0, fleetQuantity - conflictingBookings.length);

  const resolveClientId = async (): Promise<string | null> => {
    if (clientId) return clientId;
    const phoneKey = customerPhone.trim();
    const existing = clients.find(
      (c) =>
        c.name.trim().toLowerCase() === customerName.trim().toLowerCase() &&
        (c.phone || "") === phoneKey,
    );
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: customerName.trim(),
        phone: phoneKey || null,
        email: customerEmail.trim() || null,
        id_document: idDocument.trim() || null,
      })
      .select("id")
      .single();
    if (error) return null;
    return data.id as string;
  };

  const buildSubmitData = async () => {
    const resolvedClientId = await resolveClientId();
    return {
      customer_name: customerName,
      customer_phone: customerPhone || null,
      customer_email: customerEmail || null,
      client_id: resolvedClientId,
      vehicle_id: vehicleId,
      plate: assignedPlate || null,
      check_in: format(checkIn!, "yyyy-MM-dd"),
      check_out: format(checkOut!, "yyyy-MM-dd"),
      comments: comments || null,
      payment_notes: paymentNotes || null,
      status,
      delivery_location: deliveryLocation || null,
      deposit_amount: depositAmount ? Number(depositAmount) : 0,
      total_price: totalPrice ? Number(totalPrice) : 0,
      id_document: idDocument || null,
      booking_source: bookingSource,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !vehicleId || !checkIn || !checkOut) return;

    const data = await buildSubmitData();

    if (conflictingBookings.length > 0) {
      setPendingSubmitData(data);
      setShowConflictDialog(true);
      return;
    }

    doSubmit(data);
  };

  const doSubmit = (data: any) => {
    const isEditingMode = editBooking && !isDuplicate;
    if (isEditingMode) {
      updateBooking.mutate(
        { id: editBooking.id, ...data },
        {
          onSuccess: () => {
            toast.success("Η κράτηση ενημερώθηκε!");
            navigate("/bookings");
          },
          onError: () => {
            toast.error("Σφάλμα κατά την ενημέρωση");
          },
        }
      );
    } else {
      createBooking.mutate(data, {
          onSuccess: () => {
            toast.success("Η κράτηση δημιουργήθηκε!");
            navigate("/bookings");
          },
          onError: () => {
            toast.error("Σφάλμα κατά τη δημιουργία");
          },
        });
      }
  };

  const handleConflictContinue = () => {
    setShowConflictDialog(false);
    if (pendingSubmitData) {
      doSubmit(pendingSubmitData);
      setPendingSubmitData(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (editBooking) {
      deleteBooking.mutate(editBooking.id, {
        onSuccess: () => {
          toast.success("Η κράτηση διαγράφηκε!");
          navigate("/bookings");
        },
        onError: () => {
          toast.error("Σφάλμα κατά τη διαγραφή");
        },
      });
    }
    setShowDeleteDialog(false);
  };

  const handleDuplicateToggle = () => {
    setIsDuplicate(true);
    setCheckIn(undefined);
    setCheckOut(undefined);
    setStatus("pending");
  };

  const handleWhatsApp = () => {
    if (!customerPhone || !selectedVehicle || !checkIn || !checkOut) {
      toast.error("Συμπληρώστε τηλέφωνο, όχημα και ημερομηνίες");
      return;
    }
    const url = buildWhatsAppUrl({
      customerName,
      customerPhone,
      vehicleName: selectedVehicle.name,
      checkIn: format(checkIn, "yyyy-MM-dd"),
      checkOut: format(checkOut, "yyyy-MM-dd"),
      deliveryLocation: deliveryLocation || undefined,
      totalPrice: totalPrice ? Number(totalPrice) : undefined,
    });
    window.open(url, "_blank");
  };

  const handleAiPrice = async () => {
    if (!vehicleId || !checkIn || !checkOut || !selectedVehicle) {
      toast.error("Επιλέξτε όχημα και ημερομηνίες πρώτα");
      return;
    }
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-price", {
        body: {
          vehicle_name: selectedVehicle.name,
          daily_rate_low: selectedVehicle.daily_rate_low,
          daily_rate_high: selectedVehicle.daily_rate_high,
          check_in: format(checkIn, "yyyy-MM-dd"),
          check_out: format(checkOut, "yyyy-MM-dd"),
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAiSuggestion(data);
    } catch (err: any) {
      toast.error(err.message || "Σφάλμα AI πρότασης τιμής");
    } finally {
      setAiLoading(false);
    }
  };

  const daysCount = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const totalPriceNum = totalPrice ? Number(totalPrice) : 0;
  const depositNum = depositAmount ? Number(depositAmount) : 0;
  const remainingBalance = totalPriceNum - depositNum;

  const conflictDialog = (
    <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Σύγκρουση κρατήσεων
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Το όχημα <strong>{selectedVehicle?.name}</strong> έχει ήδη{" "}
                {conflictingBookings.length === 1 ? "κράτηση" : `${conflictingBookings.length} κρατήσεις`}{" "}
                για τις ημερομηνίες που επιλέξατε:
              </p>
              {conflictingBookings.map((b) => (
                <div key={b.id} className="rounded-md border p-2 bg-muted/50 text-sm">
                  <p className="font-medium">{b.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(b.check_in), "d MMMM", { locale: el })} → {format(parseISO(b.check_out), "d MMMM yyyy", { locale: el })} · {STATUS_LABELS[b.status]}
                  </p>
                </div>
              ))}
              <p className="text-sm font-medium">Θέλετε να συνεχίσετε;</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
          <AlertDialogAction onClick={handleConflictContinue} className="bg-warning text-warning-foreground hover:bg-warning/90">
            Συνέχεια
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const deleteDialog = (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Διαγραφή κράτησης</AlertDialogTitle>
          <AlertDialogDescription>
            Είστε σίγουροι ότι θέλετε να διαγράψετε την κράτηση του{" "}
            <strong>{editBooking?.customer_name}</strong>
            {selectedVehicle ? ` (${selectedVehicle.name})` : ""}; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Διαγραφή
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (id && !editBooking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
        <h2 className="text-lg font-bold text-foreground mb-1">Η κράτηση δεν βρέθηκε</h2>
        <p className="text-sm mb-4 font-normal">Ίσως έχει διαγραφεί ή το link είναι εσφαλμένο.</p>
        <Button onClick={() => navigate("/bookings")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Επιστροφή στις κρατήσεις
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12 page-enter">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-5 md:py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/bookings")}
              className="h-9 w-9 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-xl md:text-2xl tracking-tight text-foreground">
                {editBooking ? (isDuplicate ? "Αντιγραφή κράτησης" : "Επεξεργασία κράτησης") : "Νέα κράτηση"}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                {editBooking && !isDuplicate ? `Κράτηση του/της ${editBooking.customer_name}` : "Πελάτης · Όχημα · Οικονομικά · Επικοινωνία"}
              </p>
            </div>
          </div>
          {editBooking && !isDuplicate && (
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium border capitalize",
                status === "confirmed" && "bg-success/10 text-success border-success/25",
                status === "pending" && "bg-warning/10 text-warning border-warning/25",
                status === "cancelled" && "bg-destructive/10 text-destructive border-destructive/25"
              )}>
                {STATUS_LABELS[status] || status}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Conflict warning banner */}
          {conflictingBookings.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 flex items-start gap-3 shadow-sm animate-pulse-subtle">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-warning">Σύγκρουση ημερομηνιών</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Το όχημα <strong>{selectedVehicle?.name}</strong> έχει ήδη{" "}
                  {conflictingBookings.length === 1 ? "κράτηση" : `${conflictingBookings.length} κρατήσεις`} για αυτές τις ημερομηνίες:
                </p>
                <div className="mt-2 space-y-1">
                  {conflictingBookings.map((b) => (
                    <p key={b.id} className="text-xs text-foreground/80">
                      • <strong>{b.customer_name}</strong> — {format(parseISO(b.check_in), "d MMM", { locale: el })} → {format(parseISO(b.check_out), "d MMM", { locale: el })} ({STATUS_LABELS[b.status] || b.status})
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left/Main Content Column */}
            <div className="md:col-span-2 space-y-6">
              {/* Customer info card */}
              <div className="bg-card/70 border border-border/80 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
                <h2 className="font-display text-lg">Πελάτης</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Όνομα πελάτη *</Label>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required placeholder="π.χ. Γιάννης Παπαδόπουλος" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Τηλέφωνο</Label>
                    <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="π.χ. 6971234567" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Email</Label>
                    <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="π.χ. email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Αρ. Ταυτότητας / Διαβατηρίου</Label>
                    <Input value={idDocument} onChange={(e) => setIdDocument(e.target.value)} placeholder="π.χ. AK123456" />
                  </div>
                </div>
              </div>

              {/* Booking Info Card */}
              <div className="bg-card/70 border border-border/80 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
                <h2 className="font-display text-lg">Όχημα και ημερομηνίες</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Όχημα *</Label>
                    <Select
                      value={vehicleId}
                      onValueChange={(v) => {
                        setVehicleId(v);
                        setAssignedPlate("");
                      }}
                      required
                    >
                      <SelectTrigger><SelectValue placeholder="Επιλέξτε όχημα" /></SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} ({v.cc}cc)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Πηγή κράτησης</Label>
                    <Select value={bookingSource} onValueChange={setBookingSource}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {vehiclePlates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Μονάδα / Πινακίδα</Label>
                    <div className="flex flex-wrap gap-2">
                      {vehiclePlates.map((p) => {
                        const taken = takenPlates.has(p) && assignedPlate !== p;
                        const active = assignedPlate === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={taken}
                            onClick={() => setAssignedPlate(active ? "" : p)}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.96]",
                              taken
                                ? "bg-destructive/10 text-destructive border-destructive/40 line-through cursor-not-allowed opacity-80"
                                : active
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    {checkIn && checkOut ? (
                      <p className={cn("text-[11px]", freeUnits === 0 ? "text-destructive font-medium" : "text-muted-foreground")}>
                        Διαθέσιμες μονάδες: {freeUnits}/{fleetQuantity} για τις επιλεγμένες ημερομηνίες
                        {freeUnits === 0 && " — πλήρως κλεισμένο"}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Επιλέξτε ημερομηνίες για να δείτε ποιες μονάδες είναι διαθέσιμες.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Check-in *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !checkIn && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkIn ? format(checkIn, "dd/MM/yyyy") : "Επιλέξτε ημερομηνία"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={checkIn} onSelect={setCheckIn} locale={el} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Check-out *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !checkOut && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkOut ? format(checkOut, "dd/MM/yyyy") : "Επιλέξτε ημερομηνία"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={checkOut} onSelect={setCheckOut} locale={el} disabled={(date) => checkIn ? date < checkIn : false} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {daysCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs text-muted-foreground font-medium">
                    Διάρκεια: {daysCount} ημέρ{daysCount === 1 ? "α" : "ες"}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Τοποθεσία παράδοσης</Label>
                  <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="π.χ. Λιμάνι, Ξενοδοχείο Αναμαρία..." />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Σχόλια</Label>
                  <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Σχόλια / σημειώσεις..." rows={3} />
                </div>
              </div>

              {/* Checklist - only for existing bookings */}
              {editBooking && !isDuplicate && (
                <div className="bg-card/70 border border-border/80 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
                  <h2 className="font-display text-lg">Checklist παράδοσης / παραλαβής</h2>
                  <VehicleChecklist bookingId={editBooking.id} />
                </div>
              )}
            </div>

            {/* Right Column: Financial & Actions */}
            <div className="space-y-6">
              {/* Pricing card */}
              <div className="bg-card/70 border border-border/80 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="font-display text-lg">Οικονομικά</h2>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Κατάσταση κράτησης</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["pending", "confirmed", "cancelled"] as const).map((value) => (
                        <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Συνολικό ποσό (€)</Label>
                  <div className="flex gap-1.5">
                    <Input type="number" min="0" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} placeholder="0" className="text-lg font-semibold" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAiPrice}
                      disabled={aiLoading}
                      title="AI Πρόταση τιμής"
                      className="shrink-0"
                    >
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    </Button>
                  </div>

                  {aiSuggestion && (
                    <div className="rounded-lg border bg-primary/5 p-3.5 space-y-1.5 transition-all animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary">
                          {aiSuggestion.suggested_total}€
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            ({aiSuggestion.daily_rate}€/ημέρα)
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs hover:bg-primary/10 hover:text-primary"
                          onClick={() => {
                            setTotalPrice(String(aiSuggestion.suggested_total));
                            setAiSuggestion(null);
                            toast.success("Τιμή AI εφαρμόστηκε!");
                          }}
                        >
                          Εφαρμογή
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{aiSuggestion.explanation}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Προκαταβολή (€)</Label>
                  <Input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" />
                </div>

                {/* Remaining balance badge */}
                {totalPriceNum > 0 && (
                  <div className="flex items-center justify-between text-xs border-t pt-3">
                    <span className="text-muted-foreground">Υπόλοιπο:</span>
                    <span className={cn(
                      "font-bold px-2.5 py-1 rounded-md text-sm",
                      remainingBalance > 0
                        ? "bg-warning/10 text-warning border border-warning/20"
                        : "bg-success/10 text-success border border-success/20"
                    )}>
                      {remainingBalance > 0 ? `${remainingBalance}€` : "Εξοφλημένο"}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Σημειώσεις πληρωμής</Label>
                  <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="π.χ. Πληρώθηκε μετρητά" />
                </div>
              </div>

              {/* Utility actions card */}
              {((editBooking && !isDuplicate) || customerPhone) && (
                <div className="bg-card/70 border border-border/80 rounded-xl p-5 shadow-sm space-y-3 animate-in fade-in duration-200">
                  <h2 className="font-display text-lg mb-1">Επικοινωνία</h2>
                  <div className="flex flex-col gap-2">
                    {editBooking && !isDuplicate && (
                      <BookingReceipt booking={editBooking} vehicle={selectedVehicle} />
                    )}
                    {customerPhone && (
                      <Button type="button" variant="outline" onClick={handleWhatsApp} className="w-full gap-2 justify-center">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                        <span>WhatsApp Επιβεβαίωση</span>
                      </Button>
                    )}
                    {editBooking && !isDuplicate && (
                      <Button type="button" variant="secondary" onClick={handleDuplicateToggle} className="w-full justify-center">
                        Αντιγραφή Κράτησης
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Main Submit & Cancel Buttons */}
              <div className="bg-card/70 border border-border/80 rounded-xl p-5 shadow-sm space-y-3">
                <Button type="submit" className="w-full text-base font-semibold py-5">
                  {editBooking && !isDuplicate ? "Ενημέρωση Κράτησης" : "Αποθήκευση Κράτησης"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/bookings")} className="w-full">
                  Ακύρωση
                </Button>
                {editBooking && !isDuplicate && (
                  <Button type="button" variant="destructive" onClick={() => setShowDeleteDialog(true)} className="w-full animate-in fade-in duration-200">
                    Διαγραφή Κράτησης
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {conflictDialog}
      {deleteDialog}
    </div>
  );
}
