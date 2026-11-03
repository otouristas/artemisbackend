import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Inbox, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useBookingRequests,
  useCreateBookingRequest,
  useUpdateBookingRequest,
  useRejectBookingRequest,
  type BookingRequest,
} from "@/hooks/useBookingRequests";
import { useVehicles } from "@/hooks/useVehicles";
import { useBookings } from "@/hooks/useBookings";
import { RequestListItem } from "@/components/requests/RequestListItem";
import { RequestDetail, type Alternative } from "@/components/requests/RequestDetail";
import { RequestFormDialog } from "@/components/requests/RequestFormDialog";
import { AcceptRequestDialog } from "@/components/requests/AcceptRequestDialog";
import {
  conflictingBookings,
  emptyForm,
  formFromRequest,
  freeUnitsForVehicle,
  matchVehicleId,
  toInsert,
  type FilterKey,
  type FormState,
  type VehicleTypeFilter,
} from "@/components/requests/requestUtils";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "new", label: "Νέα" },
  { key: "reviewed", label: "Ελεγμένα" },
  { key: "accepted", label: "Αποδεκτά" },
  { key: "rejected", label: "Απορριφθέντα" },
  { key: "all", label: "Όλα" },
];

export default function RequestsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: requests = [], isLoading } = useBookingRequests();
  const { data: vehicles = [] } = useVehicles();
  const { data: bookings = [] } = useBookings();
  const createRequest = useCreateBookingRequest();
  const updateRequest = useUpdateBookingRequest();
  const rejectRequest = useRejectBookingRequest();

  const [filter, setFilter] = useState<FilterKey>("new");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BookingRequest | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [rejectTarget, setRejectTarget] = useState<BookingRequest | null>(null);

  // Master-detail selection. On < lg the detail is a full-screen view.
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("id"));
  const [mobileDetail, setMobileDetail] = useState<boolean>(() => !!searchParams.get("id"));
  const lastIndexRef = useRef(0);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Edit-form vehicle type filter + selected fleet id
  const [editTypeFilter, setEditTypeFilter] = useState<VehicleTypeFilter>("all");
  const [editFleetId, setEditFleetId] = useState("");

  // Accept dialog: pick alternate vehicle / type
  const [acceptTarget, setAcceptTarget] = useState<BookingRequest | null>(null);
  const [acceptTypeFilter, setAcceptTypeFilter] = useState<VehicleTypeFilter>("all");
  const [acceptVehicleId, setAcceptVehicleId] = useState("");
  const [acceptSaving, setAcceptSaving] = useState(false);

  const activeVehicles = useMemo(() => vehicles.filter((v) => v.active !== false), [vehicles]);

  // A deep-linked request should land in a tab that contains it.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !selectedId || requests.length === 0) return;
    deepLinkHandled.current = true;
    const r = requests.find((x) => x.id === selectedId);
    if (r && r.status !== "new") setFilter(r.status);
  }, [requests, selectedId]);

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
    const byStatus = filter === "all" ? requests : requests.filter((r) => r.status === filter);
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((r) =>
      [r.customer_name, r.customer_email, r.customer_phone, r.requested_vehicle, r.pickup_location]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [requests, filter, query]);

  // Per-request matched vehicle + availability (memoised for the whole list)
  const availability = useMemo(() => {
    const map: Record<string, { vehicleId: string; free: number | null }> = {};
    for (const r of requests) {
      const vehicleId = matchVehicleId(r.requested_vehicle, activeVehicles);
      const v = activeVehicles.find((x) => x.id === vehicleId);
      map[r.id] = {
        vehicleId,
        free: v ? freeUnitsForVehicle(v, r.check_in, r.check_out, bookings) : null,
      };
    }
    return map;
  }, [requests, activeVehicles, bookings]);

  // Resolve selection; if the selected item left this view (e.g. after reject), advance in place.
  const selectedIndex = useMemo(() => {
    if (filtered.length === 0) return -1;
    const idx = selectedId ? filtered.findIndex((r) => r.id === selectedId) : -1;
    if (idx >= 0) return idx;
    return Math.min(lastIndexRef.current, filtered.length - 1);
  }, [filtered, selectedId]);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (selectedIndex >= 0) lastIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    if (mobileDetail && !selected) setMobileDetail(false);
  }, [mobileDetail, selected]);

  const selectedVehicle = selected
    ? activeVehicles.find((v) => v.id === availability[selected.id]?.vehicleId)
    : undefined;
  const selectedFree = selected ? (availability[selected.id]?.free ?? null) : null;

  const selectedConflicts = useMemo(
    () =>
      selected && selectedVehicle
        ? conflictingBookings(selectedVehicle, selected.check_in, selected.check_out, bookings)
        : [],
    [selected, selectedVehicle, bookings],
  );

  const alternatives = useMemo<Alternative[]>(() => {
    if (!selected) return [];
    const pool = selectedVehicle
      ? activeVehicles.filter((v) => v.type === selectedVehicle.type && v.id !== selectedVehicle.id)
      : activeVehicles;
    return pool
      .map((v) => ({ vehicle: v, free: freeUnitsForVehicle(v, selected.check_in, selected.check_out, bookings) }))
      .filter((a) => a.free > 0)
      .sort((a, b) => b.free - a.free)
      .slice(0, 3);
  }, [selected, selectedVehicle, activeVehicles, bookings]);

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

  const selectRequest = (id: string, openOnMobile = true) => {
    setSelectedId(id);
    if (openOnMobile) {
      setMobileDetail(true);
      if (window.matchMedia("(max-width: 1023px)").matches) window.scrollTo({ top: 0 });
    }
  };

  const step = (delta: number) => {
    if (selectedIndex < 0) return;
    const next = filtered[selectedIndex + delta];
    if (!next) return;
    setSelectedId(next.id);
    itemRefs.current[next.id]?.scrollIntoView({ block: "nearest" });
  };

  // Linear-style keyboard navigation: j/k or arrows move through the list.
  const anyDialogOpen = dialogOpen || !!acceptTarget || !!rejectTarget;
  useEffect(() => {
    if (anyDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

  const openAccept = (r: BookingRequest, vehicleId?: string) => {
    const matched = vehicleId ?? matchVehicleId(r.requested_vehicle, activeVehicles);
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
        const created = await createRequest.mutateAsync({
          ...payload,
          status: "new",
          source: payload.source || "manual",
        });
        toast.success("Το αίτημα δημιουργήθηκε");
        if (created?.id) {
          setFilter("new");
          setQuery("");
          setSelectedId(created.id);
        }
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
    } catch {
      toast.error("Σφάλμα αποθήκευσης");
    }
  };

  const handleMarkReviewed = (r: BookingRequest) => {
    updateRequest.mutate(
      { id: r.id, status: "reviewed" },
      {
        onSuccess: () => toast.success("Σημειώθηκε ως ελεγμένο"),
        onError: () => toast.error("Σφάλμα ενημέρωσης αιτήματος"),
      },
    );
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
            acceptTarget.requested_vehicle && acceptTarget.requested_vehicle !== vehicle.name
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

  const subtitle = `${counts.new} νέα · ${requests.length} συνολικά`;

  return (
    <div className="flex flex-col lg:h-screen">
      {/* Page bar */}
      <header
        className={cn(
          "flex shrink-0 items-center gap-3 px-4 pb-3 pt-5 sm:px-6 lg:h-[72px] lg:border-b lg:px-6 lg:py-0",
          mobileDetail && "hidden lg:flex",
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground lg:text-2xl">
            Αιτήματα
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-full px-4" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Νέο αίτημα</span>
          <span className="sm:hidden">Νέο</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── List column ─────────────────────────────── */}
        <section
          className={cn(
            "flex w-full min-w-0 flex-col lg:w-[400px] lg:shrink-0 lg:border-r xl:w-[440px]",
            mobileDetail && "hidden lg:flex",
          )}
          aria-label="Λίστα αιτημάτων"
        >
          <div className="shrink-0 space-y-3 border-b px-4 pb-0 pt-1 sm:px-6 lg:px-4 lg:pt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Αναζήτηση ονόματος, τηλεφώνου, οχήματος…"
                className="h-10 rounded-full bg-muted/50 pl-9 pr-9"
                aria-label="Αναζήτηση αιτημάτων"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Καθαρισμός αναζήτησης"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status tabs with counts (underline) */}
            <div
              role="tablist"
              className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-4 lg:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {TABS.map((tab) => {
                const active = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      "relative flex shrink-0 items-center gap-1.5 px-2.5 pb-3 pt-1.5 text-sm font-medium transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    <span
                      className={cn(
                        "min-w-[1.25rem] rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums",
                        active && tab.key === "new" && counts.new > 0
                          ? "bg-accent text-accent-foreground"
                          : active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {counts[tab.key]}
                    </span>
                    {active && (
                      <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 px-2 py-2 sm:px-4 lg:overflow-y-auto lg:px-2">
            {isLoading ? (
              <div className="space-y-1 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-2 py-3">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/5" />
                      <Skeleton className="h-3 w-4/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-display text-lg font-semibold">
                  {query ? "Κανένα αποτέλεσμα" : "Δεν υπάρχουν αιτήματα"}
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  {query
                    ? "Δοκιμάστε άλλη αναζήτηση ή άλλη καρτέλα."
                    : "Τα αιτήματα από τον ιστότοπο εμφανίζονται εδώ, ή προσθέστε χειροκίνητα."}
                </p>
                {!query && (
                  <Button className="mt-4" variant="outline" onClick={openCreate}>
                    Νέο αίτημα
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((r) => {
                  const a = availability[r.id];
                  return (
                    <RequestListItem
                      key={r.id}
                      ref={(el) => {
                        itemRefs.current[r.id] = el;
                      }}
                      request={r}
                      vehicle={activeVehicles.find((v) => v.id === a?.vehicleId)}
                      free={a?.free ?? null}
                      selected={selected?.id === r.id}
                      onSelect={() => selectRequest(r.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Detail pane ─────────────────────────────── */}
        <section
          className={cn(
            "min-w-0 flex-1 bg-background lg:overflow-y-auto",
            !mobileDetail && "hidden lg:block",
          )}
          aria-label="Λεπτομέρειες αιτήματος"
        >
          {selected ? (
            <RequestDetail
              key={selected.id}
              request={selected}
              vehicle={selectedVehicle}
              free={selectedFree}
              conflicts={selectedConflicts}
              alternatives={alternatives}
              position={{ index: selectedIndex, total: filtered.length }}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onBack={() => setMobileDetail(false)}
              onAccept={(vehicleId) => openAccept(selected, vehicleId)}
              onReject={() => setRejectTarget(selected)}
              onEdit={() => openEdit(selected)}
              onMarkReviewed={() => handleMarkReviewed(selected)}
              onViewBooking={() => selected.booking_id && navigate(`/booking/${selected.booking_id}`)}
              markingReviewed={updateRequest.isPending}
            />
          ) : (
            <div className="hidden h-full flex-col items-center justify-center p-10 text-center lg:flex">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-display text-lg font-semibold">
                {isLoading ? "Φόρτωση αιτημάτων…" : "Επιλέξτε ένα αίτημα"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Δείτε στοιχεία ταξιδιού, διαθεσιμότητα και επικοινωνήστε με τον πελάτη.
              </p>
            </div>
          )}
        </section>
      </div>

      <RequestFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={!!editing}
        form={form}
        setField={setField}
        typeFilter={editTypeFilter}
        onTypeFilterChange={setEditTypeFilter}
        fleetId={editFleetId}
        onFleetIdChange={setEditFleetId}
        fleetOptions={editFleetOptions}
        vehicles={activeVehicles}
        bookings={bookings}
        saving={createRequest.isPending || updateRequest.isPending}
        onSave={() => void handleSave()}
      />

      <AcceptRequestDialog
        target={acceptTarget}
        onClose={() => setAcceptTarget(null)}
        typeFilter={acceptTypeFilter}
        onTypeFilterChange={setAcceptTypeFilter}
        vehicleId={acceptVehicleId}
        onVehicleIdChange={setAcceptVehicleId}
        options={acceptFleetOptions}
        bookings={bookings}
        saving={acceptSaving}
        onContinue={() => void handleAcceptContinue()}
      />

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
