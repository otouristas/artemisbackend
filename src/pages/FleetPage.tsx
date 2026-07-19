import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { Bike, Car, Plus, Trash2 } from "lucide-react";
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

export default function FleetPage() {
  const [params] = useSearchParams();
  const selectedFromUrl = params.get("vehicle");
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: bookings = [] } = useBookings();
  const { data: blocks = [] } = useVehicleBlocks();
  const updateVehicle = useUpdateVehicle();
  const createBlock = useCreateVehicleBlock();
  const deleteBlock = useDeleteVehicleBlock();

  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const today = startOfDay(new Date());

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
    }
  };

  const saveVehicle = async () => {
    if (!selected) return;
    try {
      await updateVehicle.mutateAsync({ id: selected.id, plate: plate || null, notes: notes || null });
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

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageHeader title="Στόλος" subtitle={`${vehicles.length} οχήματα · αυτοκίνητα & scooters`} />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">
          <div className="grid sm:grid-cols-2 gap-3">
            {vehicles.map((v) => {
              const status = statusByVehicle.get(v.id) ?? "available";
              const Icon = v.type === "car" ? Car : Bike;
              const active = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => openVehicle(v.id)}
                  className={cn(
                    "text-left rounded-xl border bg-card overflow-hidden transition-all",
                    active ? "ring-2 ring-accent border-accent" : "hover:border-primary/30",
                  )}
                >
                  <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    <Badge variant="outline" className={cn("absolute top-2 left-2 text-[10px] bg-card/90", statusLabel[status].className)}>
                      {statusLabel[status].text}
                    </Badge>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-medium text-sm truncate">{v.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {v.cc}cc · {v.daily_rate_low}–{v.daily_rate_high}€/ημέρα
                      {v.plate ? ` · ${v.plate}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="rounded-xl border bg-card p-4 h-fit sticky top-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Επιλέξτε όχημα για λεπτομέρειες.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.type === "car" ? "Αυτοκίνητο" : "Scooter"} · {selected.cc}cc
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Πινακίδα / ID</Label>
                  <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Σημειώσεις</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
                <Button className="w-full" onClick={() => void saveVehicle()} disabled={updateVehicle.isPending}>
                  Αποθήκευση
                </Button>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Μπλοκ συντήρησης</h3>
                    <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Νέο
                    </Button>
                  </div>
                  {vehicleBlocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Κανένα μπλοκ.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {vehicleBlocks.map((b) => (
                        <div key={b.id} className="flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs">
                          <div>
                            <p className="font-medium">
                              {format(parseISO(b.start_date), "dd/MM")} – {format(parseISO(b.end_date), "dd/MM")}
                            </p>
                            <p className="text-muted-foreground">{b.reason || "Συντήρηση"}</p>
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

                <div>
                  <h3 className="text-sm font-semibold mb-2">Επόμενες κρατήσεις</h3>
                  {upcoming.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Καμία επερχόμενη.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {upcoming.map((b) => (
                        <div key={b.id} className="rounded-lg border px-2.5 py-2 text-xs">
                          <p className="font-medium">{b.customer_name}</p>
                          <p className="text-muted-foreground">
                            {format(parseISO(b.check_in), "dd/MM")} – {format(parseISO(b.check_out), "dd/MM")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
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
