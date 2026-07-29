import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import { el } from "date-fns/locale";
import {
  Plus,
  Phone,
  Mail,
  Car,
  Check,
  X,
  Pencil,
  Inbox,
  Bike,
  LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  REQUEST_STATUS_CHIP,
  REQUEST_STATUS_LABELS,
  SOURCE_LABELS,
} from "@/lib/status";
import {
  useBookingRequests,
  useCreateBookingRequest,
  useUpdateBookingRequest,
  useRejectBookingRequest,
  type BookingRequest,
  type BookingRequestInsert,
} from "@/hooks/useBookingRequests";
import { useVehicles, type Vehicle } from "@/hooks/useVehicles";
import { useBookings } from "@/hooks/useBookings";

type FilterKey = "new" | "all" | "accepted" | "rejected" | "reviewed";
type VehicleTypeFilter = "all" | "car" | "scooter";

type FormState = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  requested_vehicle: string;
  check_in: string;
  check_out: string;
  pickup_location: string;
  return_location: string;
  child_seat: boolean;
  party_size: string;
  arrival_info: string;
  message: string;
  estimated_total: string;
  source: string;
  admin_notes: string;
  status: BookingRequest["status"];
};

const emptyForm = (): FormState => ({
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  requested_vehicle: "",
  check_in: "",
  check_out: "",
  pickup_location: "",
  return_location: "",
  child_seat: false,
  party_size: "",
  arrival_info: "",
  message: "",
  estimated_total: "",
  source: "manual",
  admin_notes: "",
  status: "new",
});

function formFromRequest(r: BookingRequest): FormState {
  return {
    customer_name: r.customer_name,
    customer_email: r.customer_email ?? "",
    customer_phone: r.customer_phone ?? "",
    requested_vehicle: r.requested_vehicle ?? "",
    check_in: r.check_in,
    check_out: r.check_out,
    pickup_location: r.pickup_location ?? "",
    return_location: r.return_location ?? "",
    child_seat: r.child_seat,
    party_size: r.party_size != null ? String(r.party_size) : "",
    arrival_info: r.arrival_info ?? "",
    message: r.message ?? "",
    estimated_total: r.estimated_total != null ? String(r.estimated_total) : "",
    source: r.source || "manual",
    admin_notes: r.admin_notes ?? "",
    status: r.status,
  };
}

function toInsert(form: FormState): BookingRequestInsert {
  return {
    customer_name: form.customer_name.trim(),
    customer_email: form.customer_email.trim() || null,
    customer_phone: form.customer_phone.trim() || null,
    requested_vehicle: form.requested_vehicle.trim() || null,
    check_in: form.check_in,
    check_out: form.check_out,
    pickup_location: form.pickup_location.trim() || null,
    return_location: form.return_location.trim() || null,
    child_seat: form.child_seat,
    party_size: form.party_size ? Number(form.party_size) : null,
    arrival_info: form.arrival_info.trim() || null,
    message: form.message.trim() || null,
    estimated_total: form.estimated_total ? Number(form.estimated_total) : null,
    source: form.source || "manual",
    admin_notes: form.admin_notes.trim() || null,
    status: form.status,
  };
}

function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart);
}

function matchVehicleId(requested: string | null | undefined, vehicles: Vehicle[]): string {
  if (!requested?.trim()) return "";
  const q = requested.trim().toLowerCase().replace(/[-_]/g, " ");
  const exact = vehicles.find((v) => v.name.toLowerCase() === q);
  if (exact) return exact.id;
  const partial = vehicles.find(
    (v) => v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase()),
  );
  return partial?.id ?? "";
}

function freeUnitsForVehicle(
  vehicle: Vehicle,
  checkIn: string,
  checkOut: string,
  bookings: { vehicle_id: string; check_in: string; check_out: string; status: string }[],
): number {
  if (!checkIn || !checkOut) return vehicle.quantity ?? 1;
  const start = parseISO(checkIn);
  const end = parseISO(checkOut);
  const conflicts = bookings.filter((b) => {
    if (b.vehicle_id !== vehicle.id || b.status === "cancelled") return false;
    return datesOverlap(start, end, parseISO(b.check_in), parseISO(b.check_out));
  });
  return Math.max(0, (vehicle.quantity ?? 1) - conflicts.length);
}

export default function RequestsPage() {
  const navigate = useNavigate();
  const { data: requests = [], isLoading } = useBookingRequests();
  const { data: vehicles = [] } = useVehicles();
  const { data: bookings = [] } = useBookings();
  const createRequest = useCreateBookingRequest();
  const updateRequest = useUpdateBookingRequest();
  const rejectRequest = useRejectBookingRequest();

  const [filter, setFilter] = useState<FilterKey>("new");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BookingRequest | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [rejectTarget, setRejectTarget] = useState<BookingRequest | null>(null);

  // Edit-form vehicle type filter + selected fleet id
  const [editTypeFilter, setEditTypeFilter] = useState<VehicleTypeFilter>("all");
  const [editFleetId, setEditFleetId] = useState("");

  // Accept dialog: pick alternate vehicle / type
  const [acceptTarget, setAcceptTarget] = useState<BookingRequest | null>(null);
  const [acceptTypeFilter, setAcceptTypeFilter] = useState<VehicleTypeFilter>("all");
  const [acceptVehicleId, setAcceptVehicleId] = useState("");
  const [acceptSaving, setAcceptSaving] = useState(false);

  const activeVehicles = useMemo(
    () => vehicles.filter((v) => v.active !== false),
    [vehicles],
  );

  const counts = useMemo(() => {
    const c = { new: 0, all: requests.length, accepted: 0, rejected: 0, reviewed: 0 };
    for (const r of requests) {
      if (r.status === "new") c.new++;
      if (r.status === "accepted") c.accepted++;
      if (r.status === "rejected") c.rejected++;
      if (r.status === "reviewed") c.reviewed++;
    }
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const editFleetOptions = useMemo(() => {
    if (editTypeFilter === "all") return activeVehicles;
    return activeVehicles.filter((v) => v.type === editTypeFilter);
  }, [activeVehicles, editTypeFilter]);

  const acceptFleetOptions = useMemo(() => {
    const list =
      acceptTypeFilter === "all"
        ? activeVehicles
        : activeVehicles.filter((v) => v.type === acceptTypeFilter);
    if (!acceptTarget) return list;
    return [...list].sort((a, b) => {
      const fa = freeUnitsForVehicle(a, acceptTarget.check_in, acceptTarget.check_out, bookings);
      const fb = freeUnitsForVehicle(b, acceptTarget.check_in, acceptTarget.check_out, bookings);
      return fb - fa;
    });
  }, [activeVehicles, acceptTypeFilter, acceptTarget, bookings]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setEditTypeFilter("all");
    setEditFleetId("");
    setDialogOpen(true);
  };

  const openEdit = (r: BookingRequest) => {
    setEditing(r);
    const next = formFromRequest(r.status === "new" ? { ...r, status: "reviewed" } : r);
    setForm(next);
    const matched = matchVehicleId(r.requested_vehicle, activeVehicles);
    setEditFleetId(matched);
    const matchedVehicle = activeVehicles.find((v) => v.id === matched);
    setEditTypeFilter(matchedVehicle?.type ?? "all");
    setDialogOpen(true);
  };

  const openAccept = (r: BookingRequest) => {
    const matched = matchVehicleId(r.requested_vehicle, activeVehicles);
    const matchedVehicle = activeVehicles.find((v) => v.id === matched);
    setAcceptTarget(r);
    setAcceptTypeFilter(matchedVehicle?.type ?? "all");
    setAcceptVehicleId(matched);
  };

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.check_in || !form.check_out) {
      toast.error("Όνομα και ημερομηνίες είναι υποχρεωτικά");
      return;
    }
    const payload = toInsert(form);
    try {
      if (editing) {
        await updateRequest.mutateAsync({ id: editing.id, ...payload });
        toast.success("Το αίτημα ενημερώθηκε");
      } else {
        await createRequest.mutateAsync({
          ...payload,
          status: "new",
          source: payload.source || "manual",
        });
        toast.success("Το αίτημα δημιουργήθηκε");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
    } catch {
      toast.error("Σφάλμα αποθήκευσης");
    }
  };

  const handleRejectConfirm = () => {
    if (!rejectTarget) return;
    rejectRequest.mutate(rejectTarget.id, {
      onSuccess: () => {
        toast.success("Το αίτημα απορρίφθηκε");
        setRejectTarget(null);
      },
      onError: () => toast.error("Σφάλμα απόρριψης"),
    });
  };

  const handleAcceptContinue = async () => {
    if (!acceptTarget || !acceptVehicleId) {
      toast.error("Επιλέξτε όχημα στόλου");
      return;
    }
    const vehicle = activeVehicles.find((v) => v.id === acceptVehicleId);
    if (!vehicle) return;

    setAcceptSaving(true);
    try {
      // Persist reassignment so the request shows the chosen fleet model
      if (acceptTarget.requested_vehicle !== vehicle.name) {
        await updateRequest.mutateAsync({
          id: acceptTarget.id,
          requested_vehicle: vehicle.name,
          status: acceptTarget.status === "new" ? "reviewed" : acceptTarget.status,
          admin_notes: [
            acceptTarget.admin_notes?.trim(),
            acceptTarget.requested_vehicle &&
            acceptTarget.requested_vehicle !== vehicle.name
              ? `Αλλαγή οχήματος: ${acceptTarget.requested_vehicle} → ${vehicle.name}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }
      setAcceptTarget(null);
      navigate(`/booking/new?requestId=${acceptTarget.id}&vehicleId=${vehicle.id}`);
    } catch {
      toast.error("Σφάλμα ενημέρωσης αιτήματος");
    } finally {
      setAcceptSaving(false);
    }
  };

  const tabs: { key: FilterKey; label: string }[] = [
    { key: "new", label: "Νέα" },
    { key: "reviewed", label: "Ελεγμένα" },
    { key: "accepted", label: "Αποδεκτά" },
    { key: "rejected", label: "Απορριφθέντα" },
    { key: "all", label: "Όλα" },
  ];

  const typeTabs: { key: VehicleTypeFilter; label: string; icon: typeof Car }[] = [
    { key: "all", label: "Όλα", icon: LayoutGrid },
    { key: "car", label: "Αυτοκίνητα", icon: Car },
    { key: "scooter", label: "Scooter", icon: Bike },
  ];

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Keep form.requested_vehicle in sync when picking from fleet in edit dialog
  useEffect(() => {
    if (!dialogOpen || !editFleetId) return;
    const v = activeVehicles.find((x) => x.id === editFleetId);
    if (v && form.requested_vehicle !== v.name) {
      setField("requested_vehicle", v.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFleetId, dialogOpen]);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 md:py-6">
      <PageHeader
        title="Αιτήματα"
        subtitle={`${counts.new} νέα · ${requests.length} συνολικά`}
        actions={
          <Button className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Νέο αίτημα
          </Button>
        }
      />

      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none -mx-3 px-3 scroll-fade-x flex-nowrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "pressable shrink-0 rounded-full px-3.5 py-1.5 min-h-9 coarse:min-h-10 coarse:px-4 text-xs font-semibold transition-colors duration-200",
              filter === tab.key
                ? "glass-chip-active text-primary"
                : "glass-chip text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="ml-1.5 opacity-75 bg-muted-foreground/10 px-1.5 py-0.5 rounded-full text-[10px]">
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-display text-xl mb-2">Δεν υπάρχουν αιτήματα</p>
          <p className="text-sm text-muted-foreground mb-4">
            Τα αιτήματα από τον ιστότοπο εμφανίζονται εδώ, ή προσθέστε χειροκίνητα.
          </p>
          <Button onClick={openCreate}>Νέο αίτημα</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const canAccept = r.status === "new" || r.status === "reviewed";
            const matchedId = matchVehicleId(r.requested_vehicle, activeVehicles);
            const free = matchedId
              ? freeUnitsForVehicle(
                  activeVehicles.find((v) => v.id === matchedId)!,
                  r.check_in,
                  r.check_out,
                  bookings,
                )
              : null;
            return (
              <div key={r.id} className="rounded-xl border bg-card px-4 py-3.5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{r.customer_name}</p>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", REQUEST_STATUS_CHIP[r.status])}
                      >
                        {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {SOURCE_LABELS[r.source] ?? r.source}
                      </Badge>
                      {free === 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/30"
                        >
                          Μη διαθέσιμο
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {r.customer_phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {r.customer_phone}
                        </span>
                      )}
                      {r.customer_email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {r.customer_email}
                        </span>
                      )}
                      {r.requested_vehicle && (
                        <span className="inline-flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          {r.requested_vehicle}
                          {free != null && (
                            <span className={cn(free === 0 ? "text-destructive font-medium" : "")}>
                              · {free} διαθέσ.
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(r.check_in), "d MMM yyyy", { locale: el })}
                      {" → "}
                      {format(parseISO(r.check_out), "d MMM yyyy", { locale: el })}
                      {r.estimated_total != null ? ` · ~€${r.estimated_total}` : ""}
                      {r.pickup_location ? ` · ${r.pickup_location}` : ""}
                    </p>
                    {(r.message || r.arrival_info) && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {[r.arrival_info, r.message].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground shrink-0">
                    {format(parseISO(r.created_at), "d MMM HH:mm", { locale: el })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canAccept && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => openAccept(r)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Αποδοχή
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Επεξεργασία
                  </Button>
                  {canAccept && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setRejectTarget(r)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Απόρριψη
                    </Button>
                  )}
                  {r.status === "accepted" && r.booking_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/booking/${r.booking_id}`)}
                    >
                      Προβολή κράτησης
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / create dialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display">
              {editing ? "Επεξεργασία αιτήματος" : "Νέο αίτημα"}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Όνομα *</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => setField("customer_name", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Τηλέφωνο</Label>
                <Input
                  value={form.customer_phone}
                  onChange={(e) => setField("customer_phone", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setField("customer_email", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Check-in *</Label>
                <Input
                  type="date"
                  value={form.check_in}
                  onChange={(e) => setField("check_in", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check-out *</Label>
                <Input
                  type="date"
                  value={form.check_out}
                  onChange={(e) => setField("check_out", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label>Όχημα στόλου (μπορείτε να αλλάξετε τύπο)</Label>
              <div className="flex flex-wrap gap-1.5">
                {typeTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setEditTypeFilter(t.key);
                      setEditFleetId("");
                    }}
                    className={cn(
                      "pressable inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      editTypeFilter === t.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <t.icon className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>
              <Select
                value={editFleetId || undefined}
                onValueChange={(id) => {
                  setEditFleetId(id);
                  const v = activeVehicles.find((x) => x.id === id);
                  if (v) setField("requested_vehicle", v.name);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε από τον στόλο…" />
                </SelectTrigger>
                <SelectContent>
                  {editFleetOptions.map((v) => {
                    const free =
                      form.check_in && form.check_out
                        ? freeUnitsForVehicle(v, form.check_in, form.check_out, bookings)
                        : null;
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.type === "scooter" ? "scooter" : "αυτ."})
                        {free != null ? ` · ${free} διαθέσ.` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Input
                value={form.requested_vehicle}
                onChange={(e) => {
                  setField("requested_vehicle", e.target.value);
                  setEditFleetId("");
                }}
                placeholder="Ή πληκτρολογήστε ελεύθερα (π.χ. slug από site)"
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Παραλαβή</Label>
                <Input
                  value={form.pickup_location}
                  onChange={(e) => setField("pickup_location", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Επιστροφή</Label>
                <Input
                  value={form.return_location}
                  onChange={(e) => setField("return_location", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Άτομα</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.party_size}
                  onChange={(e) => setField("party_size", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Εκτίμηση €</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estimated_total}
                  onChange={(e) => setField("estimated_total", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label htmlFor="child-seat">Παιδικό κάθισμα</Label>
              <Switch
                id="child-seat"
                checked={form.child_seat}
                onCheckedChange={(v) => setField("child_seat", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Άφιξη / πτήσεις</Label>
              <Input
                value={form.arrival_info}
                onChange={(e) => setField("arrival_info", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Μήνυμα</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setField("message", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Σημειώσεις γραφείου</Label>
              <Textarea
                value={form.admin_notes}
                onChange={(e) => setField("admin_notes", e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Πηγή</Label>
                <Select value={form.source} onValueChange={(v) => setField("source", v)}>
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
              {editing && (
                <div className="space-y-1.5">
                  <Label>Κατάσταση</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setField("status", v as BookingRequest["status"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["new", "reviewed", "accepted", "rejected"] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {REQUEST_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button
              onClick={() => void handleSave()}
              disabled={
                !form.customer_name.trim() ||
                !form.check_in ||
                !form.check_out ||
                createRequest.isPending ||
                updateRequest.isPending
              }
              className="coarse:h-12 coarse:rounded-xl coarse:text-base"
            >
              Αποθήκευση
            </Button>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="coarse:h-12 coarse:rounded-xl coarse:text-base"
            >
              Ακύρωση
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Accept: choose / change vehicle type & model */}
      <ResponsiveDialog
        open={!!acceptTarget}
        onOpenChange={(open) => !open && setAcceptTarget(null)}
      >
        <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display">
              Αποδοχή · επιλογή οχήματος
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {acceptTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
                <p className="font-medium">{acceptTarget.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(acceptTarget.check_in), "d MMM yyyy", { locale: el })}
                  {" → "}
                  {format(parseISO(acceptTarget.check_out), "d MMM yyyy", { locale: el })}
                </p>
                {acceptTarget.requested_vehicle && (
                  <p className="text-xs">
                    Αρχικό αίτημα:{" "}
                    <span className="font-semibold">{acceptTarget.requested_vehicle}</span>
                    {" — "}αν δεν υπάρχει διαθεσιμότητα, αλλάξτε τύπο ή μοντέλο παρακάτω.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {typeTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setAcceptTypeFilter(t.key);
                      setAcceptVehicleId("");
                    }}
                    className={cn(
                      "pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                      acceptTypeFilter === t.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {acceptFleetOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Δεν υπάρχουν οχήματα σε αυτή την κατηγορία.
                  </p>
                ) : (
                  acceptFleetOptions.map((v) => {
                    const free = freeUnitsForVehicle(
                      v,
                      acceptTarget.check_in,
                      acceptTarget.check_out,
                      bookings,
                    );
                    const selected = acceptVehicleId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setAcceptVehicleId(v.id)}
                        className={cn(
                          "w-full text-left rounded-xl border px-3 py-2.5 transition-colors",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/40",
                          free === 0 && !selected && "opacity-70",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{v.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {v.type === "scooter" ? "Scooter" : "Αυτοκίνητο"} · {v.cc}cc
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] shrink-0",
                              free === 0
                                ? "bg-destructive/10 text-destructive border-destructive/30"
                                : "bg-success/10 text-success border-success/30",
                            )}
                          >
                            {free === 0 ? "Πλήρες" : `${free} διαθέσ.`}
                          </Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button
              onClick={() => void handleAcceptContinue()}
              disabled={!acceptVehicleId || acceptSaving}
              className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 coarse:h-12 coarse:rounded-xl"
            >
              <Check className="h-4 w-4" />
              Συνέχεια στη κράτηση
            </Button>
            <Button
              variant="outline"
              onClick={() => setAcceptTarget(null)}
              className="coarse:h-12 coarse:rounded-xl"
            >
              Ακύρωση
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmSheet
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Απόρριψη αιτήματος"
        description={`Να απορριφθεί το αίτημα του/της ${rejectTarget?.customer_name ?? ""};`}
        confirmLabel="Απόρριψη"
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}
