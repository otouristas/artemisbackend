import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { Bike, Car, Plus, Trash2, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useVehicles } from "@/hooks/useVehicles";
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
  const isMobile = useIsMobile();
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: bookings = [] } = useBookings();
  const { data: blocks = [] } = useVehicleBlocks();
  const updateVehicle = useUpdateVehicle();
  const createBlock = useCreateVehicleBlock();
  const deleteBlock = useDeleteVehicleBlock();

  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [blockOpen, setBlockOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<"all" | "car" | "scooter">("all");

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

  const statusByVehicle = useMemo(() => {
    const map = new Map<string, "available" | "on_rent" | "blocked">();
    for (const v of vehicles) {
      const blocked = blocks.some(
        (b) =>
          b.vehicle_id === v.id &&
          isWithinInterval(today, {
            start: startOfDay(parseISO(b.start_date)),
            end: startOfDay(parseISO(b.end_date)),
          }),
      );
      if (blocked) {
        map.set(v.id, "blocked");
        continue;
      }
      const onRent = bookings.some((b) => {
        if (b.vehicle_id !== v.id || b.status === "cancelled") return false;
        return isWithinInterval(today, {
          start: startOfDay(parseISO(b.check_in)),
          end: startOfDay(parseISO(b.check_out)),
        });
      });
      map.set(v.id, onRent ? "on_rent" : "available");
    }
    return map;
  }, [vehicles, bookings, blocks, today]);

  const selected = vehicles.find((v) => v.id === (selectedId ?? selectedFromUrl));

  const openVehicle = (id: string) => {
    setSelectedId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) {
      setPlate(v.plate ?? "");
      setNotes(v.notes ?? "");
      setQuantity(v.quantity ?? 1);
    }
  };

  const saveVehicle = async () => {
    if (!selected) return;
    try {
      await updateVehicle.mutateAsync({
        id: selected.id,
        plate: plate || null,
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
        <div className="space-y-1.5">
          <Label>Πινακίδα / ID</Label>
          <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Ποσότητα (Στόλος)</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          />
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
                    className="h-7 w-7 text-destructive"
                    onClick={() =>
                      deleteBlock.mutate(b.id, {
                        onSuccess: () => toast.success("Διαγράφηκε"),
                      })
                    }
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
      <PageHeader title="Στόλος" subtitle={`${vehicles.length} οχήματα · αυτοκίνητα & scooters`} />

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

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredVehicles.map((v) => {
              const status = statusByVehicle.get(v.id) ?? "available";
              const Icon = v.type === "car" ? Car : Bike;
              const active = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    openVehicle(v.id);
                    if (isMobile) setDetailsOpen(true);
                  }}
                  className={cn(
                    "text-left rounded-xl border bg-card transition-all duration-200 active:scale-[0.98]",
                    active ? "ring-2 ring-accent border-accent" : "hover:border-primary/30",
                    "flex md:block items-center p-2.5 md:p-0 gap-3"
                  )}
                >
                  <div className={cn(
                    "bg-muted relative overflow-hidden shrink-0",
                    "w-14 h-14 rounded-lg md:w-full md:h-auto md:aspect-[16/9] md:rounded-t-xl md:rounded-b-none"
                  )}>
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className="h-6 w-6 md:h-10 md:w-10 text-muted-foreground" />
                      </div>
                    )}
                    <Badge variant="outline" className={cn(
                      "hidden md:inline-flex absolute top-2 left-2 text-[10px] bg-card/90", 
                      statusLabel[status].className
                    )}>
                      {statusLabel[status].text}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0 p-1 md:p-3">
                    <div className="flex items-center justify-between md:justify-start gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="font-medium text-sm truncate">{v.name}</p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "md:hidden text-[9px] px-1.5 py-0.5 shrink-0", 
                        statusLabel[status].className
                      )}>
                        {statusLabel[status].text}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
                      {v.cc}cc · {v.daily_rate_low}–{v.daily_rate_high}€/ημ.
                      {v.plate ? ` · ${v.plate}` : ""}
                      {(v.quantity ?? 1) > 1 ? ` · x${v.quantity}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
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

      {/* Mobile Drawer dialog for vehicle details */}
      {isMobile && selected && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">Λεπτομέρειες οχήματος</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              {renderDetailsForm()}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Μπλοκ συντήρησης</DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={() => void addBlock()} disabled={!blockStart || !blockEnd}>
              Αποθήκευση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
