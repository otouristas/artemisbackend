import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format, differenceInDays, parseISO, isBefore, isAfter } from "date-fns";
import { el } from "date-fns/locale";
import { CalendarIcon, MessageCircle, Sparkles, Loader2, AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateSeasonalPrice } from "@/lib/seasonRates";
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

  // Rates, extras, and payment method state
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [extraFees, setExtraFees] = useState<{ id: string; label: string; amount: number }[]>([]);
  const [newFeeLabel, setNewFeeLabel] = useState("");
  const [newFeeAmount, setNewFeeAmount] = useState("");
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<string>("");

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
      setDepositAmount("0");
      setTotalPrice(String(editBooking.total_price || ""));
      setIdDocument(editBooking.id_document || "");
      setBookingSource(editBooking.booking_source || "phone");
      setPaymentMethod(editBooking.payment_method || "cash");
      try {
        const parsed = editBooking.extra_fees_json ? JSON.parse(editBooking.extra_fees_json) : [];
        const discountItem = parsed.find((f: any) => f.id === 'returning-discount');
        if (discountItem) {
          setIsReturningCustomer(true);
          setDiscountAmount(String(Math.abs(discountItem.amount)));
        } else {
          setIsReturningCustomer(false);
          setDiscountAmount("");
        }
        setExtraFees(parsed.filter((f: any) => f.id !== 'returning-discount'));
      } catch (e) {
        setExtraFees([]);
        setIsReturningCustomer(false);
        setDiscountAmount("");
      }
      setIsManualPrice(true);
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
      setDepositAmount("0");
      setTotalPrice("");
      setIdDocument(fromClient?.id_document ?? "");
      setBookingSource("phone");
      setIsDuplicate(false);
      setPaymentMethod("cash");
      setExtraFees([]);
      setIsReturningCustomer(false);
      setDiscountAmount("");
      setIsManualPrice(false);
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
      deposit_amount: 0,
      total_price: totalPrice ? Number(totalPrice) : 0,
      id_document: idDocument || null,
      booking_source: bookingSource,
      payment_method: paymentMethod || "cash",
      extra_fees_json: (() => {
        const payload = [...extraFees];
        if (isReturningCustomer) {
          const discountAmt = -Math.abs(Number(discountAmount) || 0);
          if (discountAmt !== 0) {
            payload.push({
              id: 'returning-discount',
              label: `Έκπτωση παλιού πελάτη (${Math.abs(discountAmt)}€)`,
              amount: discountAmt
            });
          }
        }
        return payload.length > 0 ? JSON.stringify(payload) : null;
      })(),
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

  const daysCount = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;

  // Auto-calculation of seasonal rates
  const priceBreakdown = useMemo(() => {
    if (!selectedVehicle || !checkIn || !checkOut) return null;
    return calculateSeasonalPrice(selectedVehicle.name, checkIn, checkOut);
  }, [selectedVehicle, checkIn, checkOut]);

  const baseTotal = priceBreakdown?.available ? priceBreakdown.baseTotal : 0;
  const returningDiscount = isReturningCustomer ? -Math.abs(Number(discountAmount) || 0) : 0;
  const feesTotal = extraFees.reduce((sum, f) => sum + f.amount, 0);
  const autoCalculatedTotal = baseTotal + feesTotal + returningDiscount;

  useEffect(() => {
    if (!isManualPrice && autoCalculatedTotal > 0) {
      setTotalPrice(String(autoCalculatedTotal));
    }
  }, [autoCalculatedTotal, isManualPrice]);

  const totalPriceNum = totalPrice ? Number(totalPrice) : 0;

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
                </div>

                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="returning-customer"
                      checked={isReturningCustomer}
                      onChange={(e) => {
                        setIsReturningCustomer(e.target.checked);
                        if (!e.target.checked) setDiscountAmount("");
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                    />
                    <Label htmlFor="returning-customer" className="text-xs font-semibold cursor-pointer select-none">
                      Παλιός Πελάτης — Έκπτωση
                    </Label>
                  </div>
                  {isReturningCustomer && (
                    <div className="flex items-center gap-2 pl-6 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="relative flex-1 max-w-[140px]">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          placeholder="π.χ. 15"
                          className="h-8 text-sm pr-7"
                          autoFocus
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">€</span>
                      </div>
                      {discountAmount && Number(discountAmount) > 0 && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          -{discountAmount}€ από {baseTotal > 0 ? baseTotal + "€" : "τη βασική τιμή"}
                        </span>
                      )}
                    </div>
                  )}
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

              {/* Extra Fees Card */}
              <div className="bg-card/70 border border-border/80 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
                <h2 className="font-display text-lg">Πρόσθετες Χρεώσεις (Extra Fees)</h2>
                {extraFees.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Δεν έχουν προστεθεί επιπλέον χρεώσεις.</p>
                ) : (
                  <div className="space-y-2">
                    {extraFees.map((fee) => (
                      <div key={fee.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                        <span className="font-medium text-muted-foreground">{fee.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-foreground">+{fee.amount}€</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 animate-in fade-in"
                            onClick={() => setExtraFees((prev) => prev.filter((f) => f.id !== fee.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Περιγραφή</Label>
                    <Input
                      value={newFeeLabel}
                      onChange={(e) => setNewFeeLabel(e.target.value)}
                      placeholder="π.χ. Πρόσθετο κάθισμα, Απόσταση..."
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="space-y-1 flex-1">
                      <Label className="text-[11px] text-muted-foreground">Ποσό (€)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newFeeAmount}
                        onChange={(e) => setNewFeeAmount(e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!newFeeLabel.trim() || !newFeeAmount) return;
                        setExtraFees((prev) => [
                          ...prev,
                          {
                            id: Math.random().toString(36).substring(2, 9),
                            label: newFeeLabel.trim(),
                            amount: Number(newFeeAmount) || 0,
                          },
                        ]);
                        setNewFeeLabel("");
                        setNewFeeAmount("");
                      }}
                      className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Προσθήκη
                    </Button>
                  </div>
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
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalPrice}
                    onChange={(e) => {
                      setTotalPrice(e.target.value);
                      setIsManualPrice(true);
                    }}
                    placeholder="0"
                    className="text-lg font-semibold"
                  />

                  {isManualPrice && autoCalculatedTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualPrice(false);
                        setTotalPrice(String(autoCalculatedTotal));
                        toast.success("Επαναφορά στην αυτόματη τιμή!");
                      }}
                      className="text-[11px] text-primary hover:underline block text-left font-medium"
                    >
                      Επαναφορά στην αυτόματη τιμή ({autoCalculatedTotal}€)
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Τρόπος Πληρωμής</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Μετρητά (Cash)</SelectItem>
                      <SelectItem value="bank">Τραπεζική Κατάθεση (Bank Transfer)</SelectItem>
                      <SelectItem value="iris">IRIS</SelectItem>
                      <SelectItem value="card">Κάρτα (Card)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Σημειώσεις πληρωμής</Label>
                  <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="π.χ. Πληρώθηκε μετρητά" />
                </div>

                {priceBreakdown && (
                  <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2 text-xs animate-in fade-in">
                    <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Ανάλυση Τιμής ({daysCount} ημ.)</p>
                    {priceBreakdown.available ? (
                      <>
                        <div className="space-y-1.5 border-b pb-2">
                          {priceBreakdown.segments.map((seg, idx) => (
                            <div key={idx} className="flex justify-between text-muted-foreground">
                              <span>{seg.label} ({seg.days} × {seg.rate}€)</span>
                              <span className="font-medium text-foreground">{seg.subtotal}€</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Βασική τιμή:</span>
                          <span>{baseTotal}€</span>
                        </div>
                        {isReturningCustomer && discountAmount && Number(discountAmount) > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                            <span>Έκπτωση παλιού πελάτη:</span>
                            <span>{returningDiscount}€</span>
                          </div>
                        )}
                        {extraFees.length > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Πρόσθετες χρεώσεις:</span>
                            <span>+{feesTotal}€</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t pt-2 text-sm text-primary">
                          <span>Υπολογισμένη τιμή:</span>
                          <span>{autoCalculatedTotal}€</span>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-destructive font-medium leading-relaxed">
                        Οι τιμές για Scooters ισχύουν μόνο για τη μεσαία & peak σεζόν (11 Ιουν – 10 Σεπ). 
                        Εκτός αυτών των ημερομηνιών, επικοινωνήστε μαζί μας για διαθεσιμότητα.
                      </div>
                    )}
                  </div>
                )}
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
