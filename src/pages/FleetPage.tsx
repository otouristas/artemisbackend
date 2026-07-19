import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { Bike, Car, ChevronRight, Plus, Trash2, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { toast } from "sonner";
import { useVehicles, type Vehicle } from "@/hooks/useVehicles";
import { useBookings } from "@/hooks/useBookings";
import { useUpdateVehicle } from "@/hooks/useUpdateVehicle";
import {
  useCreateVehicleBlock,
  useDeleteVehicleBlock,
  useVehicleBlocks,
} from "@/hooks/useVehicleBlocks";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export default function FleetPage() {
  const [params] = useSearchParams();
  const selectedFromUrl = params.get("vehicle");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: bookings = [] } = useBookings();
  const { data: blocks = [] } = useVehicleBlocks();
  const updateVehicle = useUpdateVehicle();
  const createBlock = useCreateVehicleBlock();
  const deleteBlock = useDeleteVehicleBlock();

  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [plates, setPlates] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [blockOpen, setBlockOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "car" | "scooter">("all");

  const today = startOfDay(new Date());

  const filteredVehicles = useMemo(() => {
    if (vehicleTypeFilter === "all") return vehicles;
    return vehicles.filter((v) => v.type === vehicleTypeFilter);
  }, [vehicles, vehicleTypeFilter]);

  const vehicleTypeCounts = useMemo(() => {
    const counts = { all: 0, car: 0, scooter: 0 };
    for (const v of vehicles) {
      const qty = v.quantity ?? 1;
      counts.all += qty;
      if (v.type === "car") counts.car += qty;
      if (v.type === "scooter") counts.scooter += qty;
    }
    return counts;
  }, [vehicles]);

  // Final fleet: every type expanded into its individual units with plate + status
  type FleetUnit = {
    vehicle: Vehicle;
    unitIndex: number;
    plate: string | null;
    status: "available" | "on_rent" | "blocked";
  };

  const fleetUnits = useMemo(() => {
    const units: FleetUnit[] = [];
    for (const v of filteredVehicles) {
      const qty = v.quantity ?? 1;
      const platesArr = (v.plate ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const blocked = blocks.some(
        (b) =>
          b.vehicle_id === v.id &&
          isWithinInterval(today, {
            start: startOfDay(parseISO(b.start_date)),
            end: startOfDay(parseISO(b.end_date)),
          }),
      );
      const current = bookings.filter(
        (b) =>
          b.vehicle_id === v.id &&
          b.status !== "cancelled" &&
          isWithinInterval(today, {
            start: startOfDay(parseISO(b.check_in)),
            end: startOfDay(parseISO(b.check_out)),
          }),
      );
      const assignedPlates = new Set(current.map((b) => b.plate).filter(Boolean) as string[]);
      // bookings without an assigned plate occupy the first free units
      let unassigned = current.filter((b) => !b.plate).length;
      for (let i = 0; i < qty; i++) {
        const plate = platesArr[i] ?? null;
        let status: FleetUnit["status"] = "available";
        if (blocked) {
          status = "blocked";
        } else if (plate && assignedPlates.has(plate)) {
          status = "on_rent";
        } else if (unassigned > 0) {
          status = "on_rent";
          unassigned--;
        }
        units.push({ vehicle: v, unitIndex: i, plate, status });
      }
    }
    return units;
  }, [filteredVehicles, bookings, blocks, today]);

  const selected = vehicles.find((v) => v.id === (selectedId ?? selectedFromUrl));

  const openVehicle = (id: string) => {
    setSelectedId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) {
      const qty = v.quantity ?? 1;
      // Parse comma-separated plates from the plate field
      const existing = (v.plate ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const padded = Array.from({ length: qty }, (_, i) => existing[i] ?? "");
      setPlates(padded);
      setNotes(v.notes ?? "");
      setQuantity(v.quantity ?? 1);
    }
  };

  const saveVehicle = async () => {
    if (!selected) return;
    try {
      // Store all plates comma-separated in the existing plate TEXT field
      const nonEmpty = plates.map((p) => p.trim()).filter(Boolean);
      await updateVehicle.mutateAsync({
        id: selected.id,
        plate: nonEmpty.join(", ") || null,
        notes: notes || null,
        quantity: quantity,
      });
      toast.success("Το όχημα ενημερώθηκε");
    } catch {
      toast.error("Σφάλμα ενημέρωσης");
    }
  };

  const addBlock = async () => {
    if (!selected || !blockStart || !blockEnd) return;
    try {
      await createBlock.mutateAsync({
        vehicle_id: selected.id,
        start_date: blockStart,
        end_date: blockEnd,
        reason: blockReason || null,
      });
      toast.success("Προστέθηκε μπλοκ συντήρησης");
      setBlockOpen(false);
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
    } catch {
      toast.error("Σφάλμα μπλοκαρίσματος");
    }
  };

  const vehicleBlocks = blocks.filter((b) => b.vehicle_id === selected?.id);
  const upcoming = bookings
    .filter((b) => b.vehicle_id === selected?.id && b.status !== "cancelled" && b.check_out >= format(today, "yyyy-MM-dd"))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .slice(0, 6);

  const statusLabel = {
    available: { text: "Διαθέσιμο", className: "bg-success/15 text-success border-success/30" },
    on_rent: { text: "Σε ενοικίαση", className: "bg-primary/10 text-primary border-primary/20" },
    blocked: { text: "Μπλοκαρισμένο", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };

  const renderDetailsForm = () => {
    if (!selected) return null;
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl">{selected.name}</h2>
          <p className="text-xs text-muted-foreground">
            {selected.type === "car" ? "Αυτοκίνητο" : "Scooter"} · {selected.cc}cc · x{selected.quantity ?? 1}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Πινακίδες ανά μονάδα</Label>
          {Array.from({ length: quantity }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14 shrink-0">Μονάδα {i + 1}</span>
              <Input
                value={plates[i] ?? ""}
                placeholder="π.χ. ΑΜΗ1234"
                onChange={(e) => {
                  const next = [...plates];
                  next[i] = e.target.value;
                  setPlates(next);
                }}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label>Ποσότητα (Στόλος)</Label>
          <select
            value={quantity}
            onChange={(e) => {
              const next = parseInt(e.target.value);
              setQuantity(next);
              setPlates((prev) => Array.from({ length: next }, (_, i) => prev[i] ?? ""));
            }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Σημειώσεις</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <Button className="w-full active:scale-[0.98] transition-transform" onClick={() => void saveVehicle()} disabled={updateVehicle.isPending}>
          Αποθήκευση
        </Button>

        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Μπλοκ συντήρησης</h3>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBlockOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Νέο
            </Button>
          </div>
          {vehicleBlocks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Κανένα μπλοκ.</p>
          ) : (
            <div className="space-y-1.5">
              {vehicleBlocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs bg-muted/20">
                  <div>
                    <p className="font-medium">
                      {format(parseISO(b.start_date), "dd/MM")} – {format(parseISO(b.end_date), "dd/MM")}
                    </p>
                    <p className="text-muted-foreground text-[10px]">{b.reason || "Συντήρηση"}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 coarse:h-11 coarse:w-11 text-destructive"
                    onClick={() => setDeleteBlockId(b.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Επόμενες κρατήσεις</h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground">Καμία επερχόμενη.</p>
          ) : (
            <div className="space-y-1.5">
              {upcoming.map((b) => (
                <div key={b.id} className="rounded-lg border px-2.5 py-1.5 text-xs bg-muted/20">
                  <p className="font-medium">{b.customer_name}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {format(parseISO(b.check_in), "dd/MM")} – {format(parseISO(b.check_out), "dd/MM")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 md:py-6">
      <PageHeader
        title="Στόλος"
        subtitle={`${vehicleTypeCounts.all} οχήματα · ${vehicles.length} τύποι`}
        actions={
          <Button onClick={() => navigate("/fleet/new")} className="active:scale-[0.97] transition-transform">
            <Plus className="h-4 w-4 mr-1.5" />
            Προσθήκη οχήματος
          </Button>
        }
      />

      {/* Vehicle Type Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none -mx-3 px-3 scroll-fade-x flex-nowrap md:hidden">
        {[
          { key: "all", label: "Όλα", icon: LayoutGrid, count: vehicleTypeCounts.all },
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
                "pressable flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 min-h-9 coarse:min-h-10 coarse:px-4 text-xs font-semibold transition-colors duration-200",
                active
                  ? "glass-chip-active text-primary"
                  : "glass-chip text-muted-foreground hover:text-foreground",
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">
          <div className="inset-group border h-fit md:rounded-xl">
            {fleetUnits.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Ο στόλος είναι άδειος. Πατήστε «Προσθήκη οχήματος» για να ξεκινήσετε.
              </div>
            ) : (
              fleetUnits.map((u) => {
                const Icon = u.vehicle.type === "car" ? Car : Bike;
                const active = selected?.id === u.vehicle.id;
                const qty = u.vehicle.quantity ?? 1;
                return (
                  <button
                    key={`${u.vehicle.id}-${u.unitIndex}`}
                    onClick={() => {
                      openVehicle(u.vehicle.id);
                      if (isMobile) setDetailsOpen(true);
                    }}
                    className={cn(
                      "pressable w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 min-h-[56px] text-left transition-colors active:bg-muted/50",
                      active ? "bg-accent/10" : "hover:bg-muted/30",
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                      {u.vehicle.image_url ? (
                        <img src={u.vehicle.image_url} alt={u.vehicle.name} className="w-full h-full object-cover" />
                      ) : (
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {u.vehicle.name}
                        {qty > 1 && (
                          <span className="text-muted-foreground font-normal"> · Μονάδα {u.unitIndex + 1}/{qty}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.vehicle.cc}cc · {u.vehicle.daily_rate_low}–{u.vehicle.daily_rate_high}€/ημ.
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide",
                        u.plate ? "bg-muted/40 text-foreground/80" : "text-muted-foreground border-dashed",
                      )}
                    >
                      {u.plate || "Χωρίς πινακίδα"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 text-[10px] px-1.5 py-0.5", statusLabel[u.status].className)}
                    >
                      {statusLabel[u.status].text}
                    </Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 md:hidden" />
                  </button>
                );
              })
            )}
          </div>

          <aside className="hidden lg:block rounded-xl border bg-card p-4 h-fit sticky top-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Επιλέξτε όχημα για λεπτομέρειες.</p>
            ) : (
              renderDetailsForm()
            )}
          </aside>
        </div>
      )}

      {/* Mobile bottom sheet for vehicle details */}
      {isMobile && selected && (
        <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DrawerContent>
            <DrawerHeader className="px-4 pb-2 text-left">
              <DrawerTitle className="font-display">Λεπτομέρειες οχήματος</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-2">
              {renderDetailsForm()}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <ResponsiveDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display">Μπλοκ συντήρησης</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Από</Label>
              <Input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Έως</Label>
              <Input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Λόγος</Label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Σέρβις, ζημιά…" />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button
              onClick={() => void addBlock()}
              disabled={!blockStart || !blockEnd}
              className="coarse:h-12 coarse:rounded-xl coarse:text-base"
            >
              Αποθήκευση
            </Button>
            <Button
              variant="outline"
              onClick={() => setBlockOpen(false)}
              className="coarse:h-12 coarse:rounded-xl coarse:text-base"
            >
              Ακύρωση
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmSheet
        open={deleteBlockId !== null}
        onOpenChange={(open) => !open && setDeleteBlockId(null)}
        title="Διαγραφή μπλοκ συντήρησης;"
        description="Το όχημα θα εμφανίζεται ξανά διαθέσιμο για αυτές τις ημερομηνίες."
        onConfirm={() => {
          if (deleteBlockId) {
            deleteBlock.mutate(deleteBlockId, {
              onSuccess: () => toast.success("Διαγράφηκε"),
            });
          }
          setDeleteBlockId(null);
        }}
      />
    </div>
  );
}
