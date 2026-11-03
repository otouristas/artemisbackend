import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format, differenceInDays, parseISO, isBefore, isAfter } from "date-fns";
import { el } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Car,
  ChevronRight,
  ClipboardCheck,
  Copy,
  CreditCard,
  Globe,
  Landmark,
  MapPin,
  MessageCircle,
  PenLine,
  Plus,
  ReceiptText,
  RotateCcw,
  Smartphone,
  Sparkles,
  StickyNote,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateSeasonalPrice } from "@/lib/seasonRates";
import { calculateFromRates } from "@/lib/ratePricing";
import { useVehicleRates } from "@/hooks/useVehicleRates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { VehicleChecklist } from "@/components/VehicleChecklist";
import { BookingReceipt } from "@/components/BookingReceipt";
import { useVehicles } from "@/hooks/useVehicles";
import { useBookings, useCreateBooking, useUpdateBooking, useDeleteBooking, type BookingInsert } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { useBookingRequests, useUpdateBookingRequest } from "@/hooks/useBookingRequests";
import { STATUS_LABELS, SOURCE_LABELS } from "@/lib/status";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSection, FieldLabel } from "@/components/booking-form/FormSection";
import { VehiclePicker, type VehicleTypeFilter } from "@/components/booking-form/VehiclePicker";
import { AvailabilityStatus, DateRangeField, PlatePicker } from "@/components/booking-form/DatesAndAvailability";
import { BookingSummaryCard } from "@/components/booking-form/BookingSummaryCard";
import { MobileTotalBar } from "@/components/booking-form/MobileTotalBar";
import {
  availabilityTone,
  formatEuro,
  type ExtraFee,
  type VehicleAvailability,
} from "@/components/booking-form/utils";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Μετρητά", hint: "Cash", icon: Banknote },
  { value: "bank", label: "Τραπεζική κατάθεση", hint: "Bank transfer", icon: Landmark },
  { value: "iris", label: "IRIS", hint: "Άμεση πληρωμή", icon: Smartphone },
  { value: "card", label: "Κάρτα", hint: "Card", icon: CreditCard },
] as const;

const STATUS_OPTIONS = [
  { value: "pending" as const, dot: "bg-warning", active: "border-warning/50 bg-warning/10 text-warning" },
  { value: "confirmed" as const, dot: "bg-success", active: "border-success/50 bg-success/10 text-success" },
  { value: "cancelled" as const, dot: "bg-destructive", active: "border-destructive/50 bg-destructive/10 text-destructive" },
];

function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart);
}

function matchVehicleId(
  requested: string | null | undefined,
  vehicles: { id: string; name: string }[],
): string {
  if (!requested?.trim()) return "";
  const q = requested.trim().toLowerCase().replace(/[-_]/g, " ");
  const exact = vehicles.find((v) => v.name.toLowerCase() === q);
  if (exact) return exact.id;
  const partial = vehicles.find(
    (v) => v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase()),
  );
  return partial?.id ?? "";
}

export default function BookingFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: vehicleRates = [] } = useVehicleRates();
  const { data: bookings = [], isLoading: loadingBookings } = useBookings();
  const { data: clients = [] } = useClients();
  const { data: bookingRequests = [], isLoading: loadingRequests } = useBookingRequests();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const updateBookingRequest = useUpdateBookingRequest();

  const editBooking = useMemo(() => {
    if (!id) return null;
    return bookings.find((b) => b.id === id) || null;
  }, [id, bookings]);

  const requestId = searchParams.get("requestId") || undefined;
  const sourceRequest = useMemo(() => {
    if (!requestId) return null;
    return bookingRequests.find((r) => r.id === requestId) || null;
  }, [requestId, bookingRequests]);

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
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "car" | "scooter">("all");

  // Rates, extras, and payment method state
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [extraFees, setExtraFees] = useState<ExtraFee[]>([]);
  const [newFeeLabel, setNewFeeLabel] = useState("");
  const [newFeeAmount, setNewFeeAmount] = useState("");
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<string>("");

  // Conflict detection state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<BookingInsert | null>(null);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Tracks if the component has initialized fields from editBooking/params
  const [isInitialized, setIsInitialized] = useState(false);

  const isLoading = loadingVehicles || loadingBookings || (!!requestId && loadingRequests);

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
      setDepositAmount(String(editBooking.deposit_amount ?? 0));
      setTotalPrice(String(editBooking.total_price || ""));
      setIdDocument(editBooking.id_document || "");
      setBookingSource(editBooking.booking_source || "phone");
      setPaymentMethod(editBooking.payment_method || "cash");
      try {
        const parsed = editBooking.extra_fees_json ? JSON.parse(editBooking.extra_fees_json) : [];
        const discountItem = parsed.find((f: ExtraFee) => f.id === 'returning-discount');
        if (discountItem) {
          setIsReturningCustomer(true);
          setDiscountAmount(String(Math.abs(discountItem.amount)));
        } else {
          setIsReturningCustomer(false);
          setDiscountAmount("");
        }
        setExtraFees(parsed.filter((f: ExtraFee) => f.id !== 'returning-discount'));
      } catch (e) {
        setExtraFees([]);
        setIsReturningCustomer(false);
        setDiscountAmount("");
      }
      setIsManualPrice(true);
    } else if (sourceRequest) {
      const commentParts = [
        sourceRequest.message?.trim(),
        sourceRequest.arrival_info?.trim()
          ? `Άφιξη: ${sourceRequest.arrival_info.trim()}`
          : null,
        sourceRequest.child_seat ? "Παιδικό κάθισμα" : null,
        sourceRequest.party_size ? `Άτομα: ${sourceRequest.party_size}` : null,
        sourceRequest.requested_vehicle
          ? `Αίτημα οχήματος: ${sourceRequest.requested_vehicle}`
          : null,
        sourceRequest.admin_notes?.trim()
          ? `Σημειώσεις: ${sourceRequest.admin_notes.trim()}`
          : null,
      ].filter(Boolean);

      setClientId(null);
      setCustomerName(sourceRequest.customer_name);
      setCustomerPhone(sourceRequest.customer_phone || "");
      setCustomerEmail(sourceRequest.customer_email || "");
      setVehicleId(
        defaultVehicleId || matchVehicleId(sourceRequest.requested_vehicle, vehicles),
      );
      setAssignedPlate("");
      {
        const chosenId =
          defaultVehicleId || matchVehicleId(sourceRequest.requested_vehicle, vehicles);
        const chosen = vehicles.find((v) => v.id === chosenId);
        setVehicleTypeFilter(chosen?.type ?? "all");
      }
      setCheckIn(parseISO(sourceRequest.check_in));
      setCheckOut(parseISO(sourceRequest.check_out));
      setComments(commentParts.join("\n") || "");
      setPaymentNotes("");
      setStatus("pending");
      setDeliveryLocation(sourceRequest.pickup_location || "");
      setDepositAmount("0");
      setTotalPrice(
        sourceRequest.estimated_total != null ? String(sourceRequest.estimated_total) : "",
      );
      setIdDocument("");
      setBookingSource("online");
      setIsDuplicate(false);
      setPaymentMethod("cash");
      setExtraFees([]);
      setIsReturningCustomer(false);
      setDiscountAmount("");
      setIsManualPrice(sourceRequest.estimated_total != null);
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
  }, [
    editBooking,
    sourceRequest,
    defaultVehicleId,
    defaultClientId,
    defaultDate,
    isLoading,
    isInitialized,
    clients,
    vehicles,
  ]);

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

  const filteredVehicles = useMemo(() => {
    const active = vehicles.filter((v) => v.active !== false);
    if (vehicleTypeFilter === "all") return active;
    return active.filter((v) => v.type === vehicleTypeFilter);
  }, [vehicles, vehicleTypeFilter]);

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

  const buildSubmitData = async (): Promise<BookingInsert> => {
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
      deposit_amount: Number(depositAmount) || 0,
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
    if (!customerName || !vehicleId || !checkIn || !checkOut) {
      if (customerName) toast.error("Επιλέξτε όχημα και ημερομηνίες check-in / check-out");
      return;
    }
    if ((Number(depositAmount) || 0) > (totalPrice ? Number(totalPrice) : 0)) {
      toast.error("Η προκαταβολή δεν μπορεί να υπερβαίνει το συνολικό ποσό");
      return;
    }

    const data = await buildSubmitData();

    if (conflictingBookings.length > 0) {
      setPendingSubmitData(data);
      setShowConflictDialog(true);
      return;
    }

    doSubmit(data);
  };

  const doSubmit = (data: BookingInsert) => {
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
          onSuccess: (created) => {
            if (requestId) {
              updateBookingRequest.mutate(
                {
                  id: requestId,
                  status: "accepted",
                  booking_id: created.id,
                },
                {
                  onSettled: () => {
                    toast.success("Η κράτηση δημιουργήθηκε από το αίτημα!");
                    navigate("/bookings");
                  },
                },
              );
              return;
            }
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
  // Rate periods from the Fleet price editor win; the old hard-coded table covers
  // models that have no periods yet.
  const priceBreakdown = useMemo(() => {
    if (!selectedVehicle || !checkIn || !checkOut) return null;
    const periods = vehicleRates.filter((r) => r.vehicle_id === selectedVehicle.id);
    if (periods.length > 0) return calculateFromRates(periods, checkIn, checkOut);
    return calculateSeasonalPrice(selectedVehicle.name, checkIn, checkOut);
  }, [selectedVehicle, checkIn, checkOut, vehicleRates]);

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
    <ConfirmSheet
      open={showDeleteDialog}
      onOpenChange={setShowDeleteDialog}
      title="Διαγραφή κράτησης"
      description={`Είστε σίγουροι ότι θέλετε να διαγράψετε την κράτηση του ${editBooking?.customer_name ?? ""}${
        selectedVehicle ? ` (${selectedVehicle.name})` : ""
      }; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`}
      onConfirm={handleDeleteConfirm}
    />
  );
  // ---- Presentation-only derived state ---------------------------------------------------------
  const summaryRef = useRef<HTMLDivElement>(null);
  const isEditing = !!editBooking && !isDuplicate;
  const isSaving = createBooking.isPending || updateBooking.isPending || updateBookingRequest.isPending;
  const hasDates = !!checkIn && !!checkOut;

  // Same overlap rule as `conflictingBookings`, applied to every model so the picker can show free units.
  const availabilityByVehicle = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const map = new Map<string, VehicleAvailability>();
    for (const v of vehicles) {
      const booked = bookings.filter((b) => {
        if (b.vehicle_id !== v.id) return false;
        if (b.status === "cancelled") return false;
        if (isEditing && b.id === editBooking?.id) return false;
        return datesOverlap(checkIn, checkOut, parseISO(b.check_in), parseISO(b.check_out));
      }).length;
      const quantity = v.quantity ?? 1;
      map.set(v.id, { booked, quantity, free: Math.max(0, quantity - booked) });
    }
    return map;
  }, [vehicles, bookings, checkIn, checkOut, isEditing, editBooking]);

  // Display-only: does the typed customer already exist? (resolveClientId does the real matching on save.)
  const matchedClient = useMemo(() => {
    if (clientId) return clients.find((c) => c.id === clientId) ?? null;
    if (!customerName.trim()) return null;
    const phoneKey = customerPhone.trim();
    return (
      clients.find(
        (c) =>
          c.name.trim().toLowerCase() === customerName.trim().toLowerCase() && (c.phone || "") === phoneKey,
      ) ?? null
    );
  }, [clientId, clients, customerName, customerPhone]);

  const tone = availabilityTone(!!vehicleId, hasDates, conflictingBookings.length, freeUnits);
  const depositNum = Number(depositAmount) || 0;
  const depositTooHigh = depositNum > totalPriceNum;

  const pageTitle = editBooking
    ? isDuplicate
      ? "Αντιγραφή κράτησης"
      : "Επεξεργασία κράτησης"
    : sourceRequest
      ? "Αποδοχή αιτήματος"
      : "Νέα κράτηση";
  const pageSubtitle =
    editBooking && !isDuplicate
      ? `Κράτηση του/της ${editBooking.customer_name}`
      : sourceRequest
        ? `Αίτημα · ${sourceRequest.customer_name} · επιλέξτε όχημα στόλου`
        : "Πελάτης · Όχημα · Οικονομικά · Επικοινωνία";
  const submitLabel = isEditing ? "Ενημέρωση κράτησης" : "Αποθήκευση κράτησης";
  const backTo = sourceRequest ? "/requests" : "/bookings";

  const addFee = () => {
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
  };

  const onFeeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFee();
    }
  };

  const handleTypeFilter = (key: VehicleTypeFilter) => {
    setVehicleTypeFilter(key);
    if (vehicleId && key !== "all" && selectedVehicle && selectedVehicle.type !== key) {
      setVehicleId("");
      setAssignedPlate("");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-3 h-9 w-72" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="hidden h-[560px] w-full rounded-xl lg:block" />
        </div>
      </div>
    );
  }

  if (id && !editBooking) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </span>
        <h2 className="mb-1 text-lg font-bold text-foreground">Η κράτηση δεν βρέθηκε</h2>
        <p className="mb-5 text-sm font-normal">Ίσως έχει διαγραφεί ή το link είναι εσφαλμένο.</p>
        <Button onClick={() => navigate("/bookings")} variant="outline" className="hover:bg-muted hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Επιστροφή στις κρατήσεις
        </Button>
      </div>
    );
  }

  const outlineBtn = "hover:bg-muted hover:text-foreground";

  return (
    <div className="pb-28 lg:pb-12">
      <form onSubmit={handleSubmit}>
        {/* ---------- Page toolbar (sticky on desktop; AppShell owns the sticky header on phones) ---------- */}
        <div className="border-b bg-background/95 backdrop-blur md:sticky md:top-0 md:z-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8 md:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigate(backTo)}
                className={cn("h-9 w-9 shrink-0 rounded-full", outlineBtn)}
                aria-label="Πίσω"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
                  <button type="button" onClick={() => navigate(backTo)} className="hover:text-foreground">
                    {sourceRequest ? "Αιτήματα" : "Κρατήσεις"}
                  </button>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate text-foreground/80">{pageTitle}</span>
                </nav>
                <div className="flex items-center gap-2.5">
                  <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-foreground md:text-2xl">{pageTitle}</h1>
                  {isEditing && (
                    <span
                      className={cn(
                        "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold sm:inline-flex",
                        status === "confirmed" && "border-success/25 bg-success/10 text-success",
                        status === "pending" && "border-warning/25 bg-warning/10 text-warning",
                        status === "cancelled" && "border-destructive/25 bg-destructive/10 text-destructive",
                      )}
                    >
                      {STATUS_LABELS[status] || status}
                    </span>
                  )}
                </div>
                <p className="truncate text-[13px] text-muted-foreground">{pageSubtitle}</p>
              </div>
            </div>

            {(isEditing || customerPhone) && (
              <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:px-0 md:pb-0">
                {customerPhone && (
                  <Button type="button" variant="outline" size="sm" onClick={handleWhatsApp} className={cn("shrink-0 gap-1.5", outlineBtn)}>
                    <MessageCircle className="h-4 w-4 text-success" />
                    WhatsApp
                  </Button>
                )}
                {isEditing && editBooking && (
                  <>
                    <BookingReceipt booking={editBooking} vehicle={selectedVehicle} showLabel className="h-9 shrink-0 px-3" />
                    <Button type="button" variant="outline" size="sm" onClick={handleDuplicateToggle} className={cn("shrink-0 gap-1.5", outlineBtn)}>
                      <Copy className="h-4 w-4" />
                      Αντιγραφή
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="shrink-0 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Διαγραφή
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8 md:pt-8">
          {isDuplicate && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
              <Copy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Αντίγραφο κράτησης.</span> Τα στοιχεία πελάτη και οχήματος
                διατηρήθηκαν — επιλέξτε νέες ημερομηνίες και αποθηκεύστε ως νέα κράτηση.
              </p>
            </div>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* ================= Left: sectioned form ================= */}
            <div className="min-w-0 space-y-6">
              {/* 1 · Customer */}
              <FormSection
                step={1}
                icon={User}
                title="Πελάτης"
                description="Ποιος νοικιάζει και από πού ήρθε η κράτηση."
                complete={!!customerName.trim()}
                aside={
                  customerName.trim() ? (
                    matchedClient ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                        <UserCheck className="h-3.5 w-3.5" /> Υπάρχων πελάτης
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        <UserPlus className="h-3.5 w-3.5" /> Νέος πελάτης
                      </span>
                    )
                  ) : null
                }
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel htmlFor="bf-name">Ονοματεπώνυμο *</FieldLabel>
                    <Input
                      id="bf-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      autoComplete="off"
                      placeholder="π.χ. Γιάννης Παπαδόπουλος"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="bf-phone">Τηλέφωνο</FieldLabel>
                    <Input
                      id="bf-phone"
                      type="tel"
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="π.χ. 6971234567"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="bf-email">Email</FieldLabel>
                    <Input
                      id="bf-email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="π.χ. email@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="bf-id" hint="Προαιρετικό">Ταυτότητα / Διαβατήριο</FieldLabel>
                    <Input
                      id="bf-id"
                      value={idDocument}
                      onChange={(e) => setIdDocument(e.target.value)}
                      placeholder="π.χ. ΑΚ 123456"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Πηγή κράτησης</FieldLabel>
                    <Select value={bookingSource} onValueChange={setBookingSource}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {matchedClient && (
                  <p className="text-xs text-muted-foreground">
                    Θα συνδεθεί με την καρτέλα πελάτη <span className="font-medium text-foreground">{matchedClient.name}</span>
                    {matchedClient.phone ? ` · ${matchedClient.phone}` : ""}.
                  </p>
                )}
                {!matchedClient && customerName.trim() && !isEditing && (
                  <p className="text-xs text-muted-foreground">Ο πελάτης θα προστεθεί αυτόματα στους πελάτες κατά την αποθήκευση.</p>
                )}
              </FormSection>

              {/* 2 · Vehicle & dates */}
              <FormSection
                step={2}
                icon={Car}
                title="Όχημα & ημερομηνίες"
                description="Μοντέλο στόλου, διάστημα ενοικίασης και διαθεσιμότητα."
                complete={!!vehicleId && hasDates && tone !== "full"}
              >
                {sourceRequest && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent/[0.06] px-3.5 py-3 text-[13px] text-muted-foreground">
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p>
                      Αρχικό αίτημα:{" "}
                      <span className="font-semibold text-foreground">
                        {sourceRequest.requested_vehicle || "χωρίς προτίμηση"}
                      </span>
                      . Αν δεν υπάρχει διαθεσιμότητα, αλλάξτε τύπο (αυτοκίνητο / scooter) και μοντέλο.
                    </p>
                  </div>
                )}

                <VehiclePicker
                  vehicles={filteredVehicles}
                  typeFilter={vehicleTypeFilter}
                  onTypeFilterChange={handleTypeFilter}
                  vehicleId={vehicleId}
                  onVehicleChange={(v) => {
                    setVehicleId(v);
                    setAssignedPlate("");
                  }}
                  availability={availabilityByVehicle}
                />

                <div className="space-y-3 border-t pt-5">
                  <DateRangeField
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onCheckInChange={setCheckIn}
                    onCheckOutChange={setCheckOut}
                    daysCount={daysCount}
                  />
                  <AvailabilityStatus
                    hasVehicle={!!vehicleId}
                    hasDates={hasDates}
                    vehicleName={selectedVehicle?.name}
                    conflicts={conflictingBookings}
                    freeUnits={freeUnits}
                    fleetQuantity={fleetQuantity}
                  />
                </div>

                <PlatePicker
                  plates={vehiclePlates}
                  takenPlates={takenPlates}
                  assignedPlate={assignedPlate}
                  onChange={setAssignedPlate}
                  hasDates={hasDates}
                />
              </FormSection>

              {/* 3 · Pickup / return */}
              <FormSection
                step={3}
                icon={MapPin}
                title="Παραλαβή / Επιστροφή"
                description="Πού παραδίδεται το όχημα και έλεγχος κατάστασης."
                complete={!!deliveryLocation.trim()}
              >
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="bf-location">Τοποθεσία παράδοσης</FieldLabel>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="bf-location"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="π.χ. Λιμάνι, Ξενοδοχείο Αναμαρία..."
                      className="pl-9"
                    />
                  </div>
                </div>

                {isEditing && editBooking ? (
                  <div className="space-y-3 border-t pt-5">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                      <p className="text-[13px] font-semibold text-foreground">Checklist παράδοσης / παραλαβής</p>
                    </div>
                    <VehicleChecklist bookingId={editBooking.id} />
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Το checklist παράδοσης / παραλαβής είναι διαθέσιμο μετά την αποθήκευση.
                  </p>
                )}
              </FormSection>

              {/* 4 · Charges */}
              <FormSection
                step={4}
                icon={ReceiptText}
                title="Χρεώσεις"
                description="Ενοικίαση, πρόσθετες χρεώσεις, εκπτώσεις και τελικό ποσό."
                complete={totalPriceNum > 0}
              >
                {/* Line items (Stripe-invoice style) */}
                <div className="overflow-hidden rounded-lg border">
                  <div className="flex items-center justify-between gap-3 bg-muted/50 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <span>Περιγραφή</span>
                    <span>Ποσό</span>
                  </div>
                  <ul className="divide-y">
                    <li className="flex items-center justify-between gap-3 px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          Ενοικίαση{selectedVehicle ? ` · ${selectedVehicle.name}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {priceBreakdown?.available
                            ? priceBreakdown.segments.map((s) => `${s.label} ${s.days}×${formatEuro(s.rate)}`).join(" · ")
                            : priceBreakdown
                              ? "Δεν υπάρχει τιμοκατάλογος για αυτές τις ημερομηνίες"
                              : "Επιλέξτε όχημα και ημερομηνίες"}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {formatEuro(baseTotal)}
                      </span>
                    </li>
                    {extraFees.map((fee) => (
                      <li key={fee.id} className="group flex items-center justify-between gap-3 px-3.5 py-2.5 animate-in fade-in">
                        <p className="min-w-0 truncate text-sm text-foreground">{fee.label}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-sm font-semibold tabular-nums text-foreground">+{formatEuro(fee.amount)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Αφαίρεση ${fee.label}`}
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setExtraFees((prev) => prev.filter((f) => f.id !== fee.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                    {isReturningCustomer && returningDiscount !== 0 && (
                      <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <p className="text-sm text-success">Έκπτωση παλιού πελάτη</p>
                        <span className="text-sm font-semibold tabular-nums text-success">{formatEuro(returningDiscount)}</span>
                      </li>
                    )}
                    {/* Add fee row */}
                    <li className="bg-muted/25 px-3.5 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={newFeeLabel}
                          onChange={(e) => setNewFeeLabel(e.target.value)}
                          onKeyDown={onFeeKeyDown}
                          placeholder="Πρόσθετη χρέωση, π.χ. Παιδικό κάθισμα"
                          aria-label="Περιγραφή χρέωσης"
                          className="h-9 flex-1 bg-card text-sm"
                        />
                        <div className="flex gap-2">
                          <div className="relative w-full sm:w-28">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={newFeeAmount}
                              onChange={(e) => setNewFeeAmount(e.target.value)}
                              onKeyDown={onFeeKeyDown}
                              placeholder="0.00"
                              aria-label="Ποσό χρέωσης"
                              className="h-9 bg-card pr-7 text-sm tabular-nums"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                              €
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addFee}
                            disabled={!newFeeLabel.trim() || !newFeeAmount}
                            className={cn("h-9 shrink-0 gap-1 px-3 text-xs font-semibold", outlineBtn)}
                          >
                            <Plus className="h-3.5 w-3.5" /> Προσθήκη
                          </Button>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Returning customer discount */}
                <div className="rounded-lg border px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="returning-customer" className="min-w-0 cursor-pointer select-none">
                      <span className="block text-sm font-medium text-foreground">Παλιός πελάτης — Έκπτωση</span>
                      <span className="block text-xs text-muted-foreground">Αφαιρείται από τη βασική τιμή ενοικίασης.</span>
                    </label>
                    <Switch
                      id="returning-customer"
                      checked={isReturningCustomer}
                      onCheckedChange={(checked) => {
                        setIsReturningCustomer(checked);
                        if (!checked) setDiscountAmount("");
                      }}
                    />
                  </div>
                  {isReturningCustomer && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="relative w-32">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="decimal"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          placeholder="π.χ. 15"
                          className="h-9 pr-7 text-sm tabular-nums"
                          aria-label="Ποσό έκπτωσης"
                          autoFocus
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                          €
                        </span>
                      </div>
                      {discountAmount && Number(discountAmount) > 0 && (
                        <span className="text-xs font-semibold text-success">
                          -{discountAmount}€ από {baseTotal > 0 ? baseTotal + "€" : "τη βασική τιμή"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Final amount */}
                <div className="rounded-lg border bg-muted/30 px-3.5 py-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <FieldLabel htmlFor="bf-total">Συνολικό ποσό</FieldLabel>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {isManualPrice ? (
                          <>
                            <PenLine className="h-3 w-3" /> Χειροκίνητη τιμή
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" /> Υπολογίζεται αυτόματα από τον τιμοκατάλογο
                          </>
                        )}
                      </p>
                    </div>
                    <div className="relative sm:w-44">
                      <Input
                        id="bf-total"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={totalPrice}
                        onChange={(e) => {
                          setTotalPrice(e.target.value);
                          setIsManualPrice(true);
                        }}
                        placeholder="0"
                        className="h-12 bg-card pr-8 text-right text-xl font-bold tabular-nums"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">
                        €
                      </span>
                    </div>
                  </div>
                  {isManualPrice && autoCalculatedTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualPrice(false);
                        setTotalPrice(String(autoCalculatedTotal));
                        toast.success("Επαναφορά στην αυτόματη τιμή!");
                      }}
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Επαναφορά στην αυτόματη τιμή ({autoCalculatedTotal}€)
                    </button>
                  )}
                </div>
              </FormSection>

              {/* 5 · Payment */}
              <FormSection
                step={5}
                icon={Wallet}
                title="Πληρωμή & κατάσταση"
                description="Τρόπος πληρωμής και κατάσταση της κράτησης."
                complete={status === "confirmed"}
              >
                <div className="space-y-2">
                  <FieldLabel>Κατάσταση κράτησης</FieldLabel>
                  <div role="radiogroup" aria-label="Κατάσταση κράτησης" className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setStatus(opt.value)}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-[13px] font-semibold transition-all active:scale-[0.98] coarse:py-3",
                            active ? opt.active : "bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                          )}
                        >
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dot)} />
                          <span className="truncate">{STATUS_LABELS[opt.value]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Τρόπος πληρωμής</FieldLabel>
                  <div role="radiogroup" aria-label="Τρόπος πληρωμής" className="grid grid-cols-2 gap-2">
                    {PAYMENT_OPTIONS.map((opt) => {
                      const active = paymentMethod === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setPaymentMethod(opt.value)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 text-left transition-all active:scale-[0.99]",
                            active ? "border-primary bg-primary/[0.04] ring-1 ring-primary" : "bg-card hover:border-foreground/25",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <opt.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-foreground">{opt.label}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{opt.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="bf-deposit" hint={`Σύνολο ${formatEuro(totalPriceNum)}`}>
                    Προκαταβολή
                  </FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative sm:w-44">
                      <Input
                        id="bf-deposit"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0"
                        aria-invalid={depositTooHigh}
                        aria-describedby="bf-deposit-help"
                        className={cn(
                          "pr-8 tabular-nums",
                          depositTooHigh && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                        €
                      </span>
                    </div>
                    <p
                      id="bf-deposit-help"
                      className={cn("text-xs", depositTooHigh ? "font-medium text-destructive" : "text-muted-foreground")}
                    >
                      {depositTooHigh
                        ? "Η προκαταβολή δεν μπορεί να υπερβαίνει το συνολικό ποσό."
                        : `Υπόλοιπο προς είσπραξη: ${formatEuro(totalPriceNum - depositNum)}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="bf-paynotes">Σημειώσεις πληρωμής</FieldLabel>
                  <Input
                    id="bf-paynotes"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="π.χ. Πληρώθηκε μετρητά"
                  />
                </div>
              </FormSection>

              {/* 6 · Notes */}
              <FormSection
                step={6}
                icon={StickyNote}
                title="Σημειώσεις"
                description="Εσωτερικά σχόλια — άφιξη, παιδικό κάθισμα, ιδιαιτερότητες."
                complete={!!comments.trim()}
              >
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Σχόλια / σημειώσεις..."
                  rows={4}
                  aria-label="Σχόλια"
                  className="resize-y"
                />
              </FormSection>
            </div>

            {/* ================= Right: sticky trip summary ================= */}
            <aside
              ref={summaryRef}
              className="scroll-mt-20 lg:sticky lg:top-[108px] lg:max-h-[calc(100vh-124px)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-xl"
            >
              <BookingSummaryCard
                vehicle={selectedVehicle}
                assignedPlate={assignedPlate}
                customerName={customerName}
                customerPhone={customerPhone}
                checkIn={checkIn}
                checkOut={checkOut}
                daysCount={daysCount}
                deliveryLocation={deliveryLocation}
                availability={tone}
                freeUnits={freeUnits}
                fleetQuantity={fleetQuantity}
                priceBreakdown={priceBreakdown}
                baseTotal={baseTotal}
                returningDiscount={returningDiscount}
                extraFees={extraFees}
                autoCalculatedTotal={autoCalculatedTotal}
                totalPrice={totalPriceNum}
                isManualPrice={isManualPrice}
                deposit={depositNum}
                status={status}
                submitLabel={submitLabel}
                isSaving={isSaving}
                onCancel={() => navigate("/bookings")}
              />
            </aside>
          </div>
        </div>

        <MobileTotalBar
          total={totalPriceNum}
          daysCount={daysCount}
          vehicleName={selectedVehicle?.name}
          submitLabel={isEditing ? "Ενημέρωση" : "Αποθήκευση"}
          isSaving={isSaving}
          onShowSummary={() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </form>

      {conflictDialog}
      {deleteDialog}
    </div>
  );
}
