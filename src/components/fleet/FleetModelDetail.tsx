import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Euro,
  Globe,
  EyeOff,
  Minus,
  Plus,
  StickyNote,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { STATUS_CHIP, STATUS_LABELS } from "@/lib/status";
import type { Booking } from "@/hooks/useBookings";
import type { VehicleBlock } from "@/hooks/useVehicleBlocks";
import type { VehicleRate } from "@/hooks/useVehicleRates";
import { useUpdateVehicle } from "@/hooks/useUpdateVehicle";
import { useCreateVehicleBlock, useDeleteVehicleBlock } from "@/hooks/useVehicleBlocks";
import { UNIT_STATUS, euro, isoDay, modelState, type ModelSummary } from "./fleetData";
import { ModelPhoto, PlateChip } from "./FleetModelCard";
import { YearPriceStrip } from "./PriceVisuals";

export type DetailTab = "overview" | "units" | "prices" | "maintenance" | "upcoming";

interface Props {
  summary: ModelSummary;
  bookings: Booking[];
  blocks: VehicleBlock[];
  rates: VehicleRate[];
  onClose: () => void;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
}

const dm = (d: string) => format(parseISO(d), "d MMM", { locale: el });

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold leading-none tracking-tight tabular-nums", tone)}>{value}</p>
      {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FleetModelDetail({ summary, bookings, blocks, rates, onClose, tab, onTabChange }: Props) {
  const navigate = useNavigate();
  const v = summary.vehicle;
  const updateVehicle = useUpdateVehicle();
  const createBlock = useCreateVehicleBlock();
  const deleteBlock = useDeleteVehicleBlock();

  // Editable copy; the parent remounts this component (key) when another model opens.
  const [quantity, setQuantity] = useState(v.quantity ?? 1);
  const [plates, setPlates] = useState<string[]>(() =>
    Array.from({ length: v.quantity ?? 1 }, (_, i) => summary.plates[i] ?? ""),
  );
  const [notes, setNotes] = useState(v.notes ?? "");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);

  const todayIso = isoDay(new Date());
  const modelRates = useMemo(() => rates.filter((r) => r.vehicle_id === v.id), [rates, v.id]);
  const futureRates = modelRates.filter((r) => r.end_date >= todayIso).slice(0, 6);
  const modelBlocks = useMemo(
    () => blocks.filter((b) => b.vehicle_id === v.id).sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [blocks, v.id],
  );
  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.vehicle_id === v.id && b.status !== "cancelled" && b.check_out >= todayIso)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))
        .slice(0, 12),
    [bookings, v.id, todayIso],
  );

  const dirty =
    quantity !== (v.quantity ?? 1) ||
    (notes || "") !== (v.notes ?? "") ||
    plates.map((p) => p.trim()).filter(Boolean).join(", ") !== summary.plates.join(", ");

  const setQty = (next: number) => {
    const n = Math.max(1, Math.min(50, next));
    setQuantity(n);
    setPlates((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ""));
  };

  const saveVehicle = async () => {
    try {
      const nonEmpty = plates.map((p) => p.trim()).filter(Boolean);
      await updateVehicle.mutateAsync({
        id: v.id,
        plate: nonEmpty.join(", ") || null,
        notes: notes || null,
        quantity,
      });
      toast.success("Το όχημα ενημερώθηκε");
    } catch {
      toast.error("Σφάλμα ενημέρωσης");
    }
  };

  const addBlock = async () => {
    if (!blockStart || !blockEnd) return;
    try {
      await createBlock.mutateAsync({
        vehicle_id: v.id,
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

  const state = modelState(summary);
  const goPrices = () => navigate(`/fleet/${v.id}/prices`);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Hero */}
      <div className="relative shrink-0">
        <ModelPhoto summary={summary} className="aspect-[16/8] w-full sm:aspect-[16/7]" iconClassName="h-14 w-14" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Κλείσιμο"
          className="absolute right-3 top-3 hidden h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-md transition hover:bg-background md:flex"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border bg-background/85 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md", state.className)}>
              {state.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border bg-background/85 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-md",
                v.show_on_site ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {v.show_on_site ? <Globe className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {v.show_on_site ? "Στο site" : "Εκτός site"}
            </span>
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{v.name}</h2>
          <p className="text-xs text-muted-foreground">
            {v.type === "car" ? "Αυτοκίνητο" : "Scooter"} · {v.cc}cc · {summary.total}{" "}
            {summary.total === 1 ? "μονάδα" : "μονάδες"}
            {v.slug ? ` · /${v.slug}` : ""}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(t) => onTabChange(t as DetailTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 shrink-0 border-b bg-background/95 px-3 backdrop-blur sm:px-5">
          <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 scrollbar-none">
            {(
              [
                ["overview", "Επισκόπηση"],
                ["units", "Μονάδες"],
                ["prices", "Τιμές"],
                ["maintenance", "Συντήρηση"],
                ["upcoming", "Κρατήσεις"],
              ] as const
            ).map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="relative h-11 shrink-0 rounded-none px-3 text-[13px] font-semibold text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-primary"
              >
                {label}
                {key === "maintenance" && summary.activeBlock && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
                {key === "upcoming" && upcoming.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{upcoming.length}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 px-4 pb-6 pt-4 sm:px-5">
          {/* Overview */}
          <TabsContent value="overview" className="mt-0 space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Ελεύθερα σήμερα"
                value={
                  <>
                    <span className="text-success">{summary.free}</span>
                    <span className="text-sm font-medium text-muted-foreground">/{summary.total}</span>
                  </>
                }
                hint={summary.onRent ? `${summary.onRent} σε ενοικίαση` : "Όλα στο γκαράζ"}
              />
              <Stat
                label="Τιμή σήμερα"
                value={summary.todayRate ? euro(summary.todayRate.daily_rate) : "–"}
                hint={summary.todayRate ? summary.todayRate.label || "ανά ημέρα" : "Χωρίς τιμή"}
                tone={summary.todayRate ? undefined : "text-destructive"}
              />
              <Stat
                label="Επόμενες"
                value={summary.upcomingCount}
                hint={summary.nextBooking ? `από ${dm(summary.nextBooking.check_in)}` : "καμία"}
              />
            </div>

            {summary.activeBlock && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Σε συντήρηση έως {dm(summary.activeBlock.end_date)}</p>
                  <p className="text-xs text-muted-foreground">{summary.activeBlock.reason || "Συντήρηση"} · όλες οι μονάδες μπλοκαρισμένες</p>
                </div>
              </div>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Μονάδες σήμερα</h3>
                <button type="button" onClick={() => onTabChange("units")} className="text-xs font-medium text-primary hover:underline">
                  Επεξεργασία
                </button>
              </div>
              <div className="divide-y rounded-xl border">
                {summary.units.map((u) => (
                  <div key={u.index} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-6 text-xs font-semibold tabular-nums text-muted-foreground">#{u.index + 1}</span>
                    <PlateChip plate={u.plate} />
                    <span className={cn("ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold", UNIT_STATUS[u.status].pill)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", UNIT_STATUS[u.status].dot)} />
                      {UNIT_STATUS[u.status].label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Τιμές {new Date().getFullYear()}</h3>
                <button type="button" onClick={goPrices} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                  Όλες οι τιμές <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              <YearPriceStrip rates={modelRates} year={new Date().getFullYear()} compact />
            </section>

            {v.notes && (
              <section className="flex gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="whitespace-pre-wrap text-foreground/90">{v.notes}</p>
              </section>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="gap-1.5" onClick={goPrices}>
                <Euro className="h-4 w-4" />
                Τιμές ανά περίοδο
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={() => setBlockOpen(true)}>
                <Wrench className="h-4 w-4" />
                Μπλοκ συντήρησης
              </Button>
            </div>
          </TabsContent>

          {/* Units & plates */}
          <TabsContent value="units" className="mt-0 space-y-5">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-semibold">Ποσότητα στον στόλο</p>
                <p className="text-xs text-muted-foreground">Ίδια οχήματα αυτού του μοντέλου</p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-full" onClick={() => setQty(quantity - 1)} disabled={quantity <= 1} aria-label="Λιγότερες">
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center text-lg font-bold tabular-nums">{quantity}</span>
                <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-full" onClick={() => setQty(quantity + 1)} aria-label="Περισσότερες">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Πινακίδες ανά μονάδα</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: quantity }, (_, i) => {
                  const status = summary.units[i]?.status;
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-xl border bg-card p-1.5 pl-3 focus-within:ring-2 focus-within:ring-ring">
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", status ? UNIT_STATUS[status].dot : "bg-muted-foreground/30")}
                        title={status ? UNIT_STATUS[status].label : "Νέα μονάδα"}
                      />
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">Μονάδα {i + 1}</span>
                      <Input
                        value={plates[i] ?? ""}
                        placeholder="π.χ. ΑΜΗ1234"
                        className="h-9 border-0 bg-transparent font-mono uppercase shadow-none focus-visible:ring-0"
                        onChange={(e) => {
                          const next = [...plates];
                          next[i] = e.target.value;
                          setPlates(next);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Σημειώσεις</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="π.χ. ζάντα πίσω δεξιά γδαρμένη" />
            </div>

            <Button className="w-full" onClick={() => void saveVehicle()} disabled={updateVehicle.isPending || !dirty}>
              {dirty ? "Αποθήκευση" : "Χωρίς αλλαγές"}
            </Button>
          </TabsContent>

          {/* Prices */}
          <TabsContent value="prices" className="mt-0 space-y-5">
            <div className="rounded-xl border p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{new Date().getFullYear()}</h3>
                <span className="text-xs text-muted-foreground">ίδια τιμή για όλες τις μονάδες</span>
              </div>
              <YearPriceStrip rates={modelRates} year={new Date().getFullYear()} onSelect={goPrices} />
            </div>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Τρέχουσες & επόμενες περίοδοι</h3>
              {futureRates.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Δεν υπάρχουν μελλοντικές τιμές.
                </p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {futureRates.map((r) => {
                    const live = r.start_date <= todayIso;
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {r.label || "Περίοδος"}
                            {live && <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">τώρα</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dm(r.start_date)} – {dm(r.end_date)} · ελάχ. {r.min_days} ημ.
                          </p>
                        </div>
                        <span className="text-sm font-bold tabular-nums">{euro(r.daily_rate)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <Button className="w-full gap-1.5" onClick={goPrices}>
              <Euro className="h-4 w-4" />
              Άνοιγμα επεξεργαστή τιμών
            </Button>
          </TabsContent>

          {/* Maintenance */}
          <TabsContent value="maintenance" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Μπλοκάρει όλες τις μονάδες για τις ημερομηνίες.</p>
              <Button size="sm" className="gap-1" onClick={() => setBlockOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Νέο
              </Button>
            </div>
            {modelBlocks.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Wrench className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Κανένα μπλοκ συντήρησης.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {modelBlocks.map((b) => {
                  const active = b.start_date <= todayIso && b.end_date >= todayIso;
                  const past = b.end_date < todayIso;
                  const days = differenceInCalendarDays(parseISO(b.end_date), parseISO(b.start_date)) + 1;
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3",
                        active && "border-destructive/30 bg-destructive/5",
                        past && "opacity-60",
                      )}
                    >
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", active ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {dm(b.start_date)} – {dm(b.end_date)}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {days} {days === 1 ? "ημέρα" : "ημέρες"}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.reason || "Συντήρηση"}
                          {active ? " · ενεργό τώρα" : past ? " · ολοκληρώθηκε" : " · προγραμματισμένο"}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-destructive coarse:h-11 coarse:w-11"
                        onClick={() => setDeleteBlockId(b.id)}
                        aria-label="Διαγραφή μπλοκ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Upcoming */}
          <TabsContent value="upcoming" className="mt-0 space-y-2">
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Καμία επερχόμενη κράτηση.</p>
              </div>
            ) : (
              upcoming.map((b) => {
                const live = b.check_in <= todayIso;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => navigate(`/booking/${b.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {format(parseISO(b.check_in), "MMM", { locale: el })}
                      </span>
                      <span className="text-lg font-bold leading-none tabular-nums">{format(parseISO(b.check_in), "d")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.customer_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dm(b.check_in)} – {dm(b.check_out)}
                        {b.plate ? ` · ${b.plate}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        live ? STATUS_CHIP.in_stay : STATUS_CHIP[b.status] ?? "",
                      )}
                    >
                      {live ? STATUS_LABELS.in_stay : STATUS_LABELS[b.status] ?? b.status}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </button>
                );
              })
            )}
          </TabsContent>
        </div>
      </Tabs>

      <ResponsiveDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display">Μπλοκ συντήρησης · {v.name}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Από</Label>
                <Input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Έως</Label>
                <Input type="date" value={blockEnd} min={blockStart || undefined} onChange={(e) => setBlockEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Λόγος</Label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Σέρβις, ζημιά…" />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button onClick={() => void addBlock()} disabled={!blockStart || !blockEnd || createBlock.isPending} className="coarse:h-12 coarse:rounded-xl coarse:text-base">
              Αποθήκευση
            </Button>
            <Button variant="outline" onClick={() => setBlockOpen(false)} className="coarse:h-12 coarse:rounded-xl coarse:text-base">
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
