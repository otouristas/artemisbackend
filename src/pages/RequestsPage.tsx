import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
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

type FilterKey = "new" | "all" | "accepted" | "rejected" | "reviewed";

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

export default function RequestsPage() {
  const navigate = useNavigate();
  const { data: requests = [], isLoading } = useBookingRequests();
  const createRequest = useCreateBookingRequest();
  const updateRequest = useUpdateBookingRequest();
  const rejectRequest = useRejectBookingRequest();

  const [filter, setFilter] = useState<FilterKey>("new");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BookingRequest | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [rejectTarget, setRejectTarget] = useState<BookingRequest | null>(null);

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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (r: BookingRequest) => {
    setEditing(r);
    setForm(formFromRequest(r.status === "new" ? { ...r, status: "reviewed" } : r));
    setDialogOpen(true);
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
        await createRequest.mutateAsync({ ...payload, status: "new", source: payload.source || "manual" });
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

  const tabs: { key: FilterKey; label: string }[] = [
    { key: "new", label: "Νέα" },
    { key: "reviewed", label: "Ελεγμένα" },
    { key: "accepted", label: "Αποδεκτά" },
    { key: "rejected", label: "Απορριφθέντα" },
    { key: "all", label: "Όλα" },
  ];

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
            return (
              <div
                key={r.id}
                className="rounded-xl border bg-card px-4 py-3.5 space-y-3"
              >
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
                      onClick={() => navigate(`/booking/new?requestId=${r.id}`)}
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
            <div className="space-y-1.5">
              <Label>Προτιμώμενο όχημα</Label>
              <Input
                value={form.requested_vehicle}
                onChange={(e) => setField("requested_vehicle", e.target.value)}
                placeholder="π.χ. Suzuki Ignis"
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
