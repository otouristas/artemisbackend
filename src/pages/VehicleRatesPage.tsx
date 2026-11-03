import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { ArrowLeft, CalendarRange, Copy, Globe, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useVehicles } from "@/hooks/useVehicles";
import { useUpdateVehicle } from "@/hooks/useUpdateVehicle";
import {
  isOverlapError,
  useCreateVehicleRates,
  useDeleteVehicleRate,
  useUpdateVehicleRate,
  useVehicleRates,
  type VehicleRate,
} from "@/hooks/useVehicleRates";
import { rateForDay } from "@/lib/ratePricing";

const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];

type Draft = { id?: string; label: string; start: string; end: string; rate: string; minDays: string };
const EMPTY_DRAFT: Draft = { label: "", start: "", end: "", rate: "", minDays: "1" };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function overlaps(a: { start_date: string; end_date: string }, b: { start_date: string; end_date: string }) {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

/** Same month/day one year later; 29 Feb becomes 28 Feb. */
function shiftYear(day: string, years: number) {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(y + years, m - 1, d);
  if (target.getMonth() !== m - 1) return iso(new Date(y + years, m, 0));
  return iso(target);
}

/** Days between today and the last priced day that have no price, as ranges. */
function findGaps(rates: VehicleRate[]) {
  if (rates.length === 0) return [];
  const today = iso(new Date());
  const last = rates.reduce((max, r) => (r.end_date > max ? r.end_date : max), today);
  const gaps: { start: string; end: string }[] = [];
  let open: string | null = null;
  for (let d = parseISO(today); iso(d) <= last; d = addDays(d, 1)) {
    const day = iso(d);
    const priced = Boolean(rateForDay(rates, day));
    if (!priced && open === null) open = day;
    if (priced && open !== null) {
      gaps.push({ start: open, end: iso(addDays(d, -1)) });
      open = null;
    }
  }
  if (open !== null) gaps.push({ start: open, end: last });
  return gaps;
}

const fmt = (day: string) => format(parseISO(day), "d MMM yyyy", { locale: el });

export default function VehicleRatesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: allRates = [], isLoading: loadingRates } = useVehicleRates();
  const createRates = useCreateVehicleRates();
  const updateRate = useUpdateVehicleRate();
  const deleteRate = useDeleteVehicleRate();
  const updateVehicle = useUpdateVehicle();

  const vehicle = vehicles.find((v) => v.id === id);
  const rates = useMemo(() => allRates.filter((r) => r.vehicle_id === id), [allRates, id]);
  const byYear = useMemo(() => {
    const groups = new Map<number, VehicleRate[]>();
    for (const r of rates) {
      const year = Number(r.start_date.slice(0, 4));
      groups.set(year, [...(groups.get(year) ?? []), r]);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [rates]);
  const gaps = useMemo(() => findGaps(rates), [rates]);
  const todayRate = rateForDay(rates, iso(new Date()));

  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [monthsYear, setMonthsYear] = useState(String(new Date().getFullYear() + 1));
  const [monthsRate, setMonthsRate] = useState("");
  const [copyFromId, setCopyFromId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [showOnSite, setShowOnSite] = useState(true);

  useEffect(() => {
    if (!vehicle) return;
    setSlug(vehicle.slug ?? "");
    setShowOnSite(vehicle.show_on_site ?? true);
  }, [vehicle]);

  const reportError = (error: unknown, fallback: string) => {
    if (isOverlapError(error)) {
      toast.error("Η περίοδος επικαλύπτει άλλη περίοδο αυτού του οχήματος. Αλλάξτε τις ημερομηνίες.");
    } else {
      toast.error(fallback);
    }
  };

  /** Insert rows that do not overlap existing ones; report how many were skipped. */
  const insertFree = async (rows: Omit<VehicleRate, "id" | "created_at" | "updated_at">[], done: string) => {
    const free = rows.filter((row) => !rates.some((r) => overlaps(r, row)));
    const skipped = rows.length - free.length;
    if (free.length === 0) {
      toast.info("Όλες οι περίοδοι υπάρχουν ήδη, δεν προστέθηκε τίποτα.");
      return;
    }
    try {
      await createRates.mutateAsync(free);
      toast.success(`${done}: ${free.length}${skipped ? ` (παραλείφθηκαν ${skipped} που επικαλύπτονταν)` : ""}`);
    } catch (e) {
      reportError(e, "Σφάλμα αποθήκευσης τιμών");
    }
  };

  const saveDraft = async () => {
    if (!draft || !vehicle) return;
    const rate = Number(draft.rate);
    const minDays = Math.max(1, Number(draft.minDays) || 1);
    if (!draft.start || !draft.end || !(rate > 0)) {
      toast.error("Συμπληρώστε ημερομηνίες και τιμή");
      return;
    }
    if (draft.end < draft.start) {
      toast.error("Η λήξη πρέπει να είναι μετά την έναρξη");
      return;
    }
    const row = {
      vehicle_id: vehicle.id,
      label: draft.label.trim() || null,
      start_date: draft.start,
      end_date: draft.end,
      daily_rate: rate,
      min_days: minDays,
    };
    try {
      if (draft.id) await updateRate.mutateAsync({ id: draft.id, ...row });
      else await createRates.mutateAsync([row]);
      toast.success("Η τιμή αποθηκεύτηκε");
      setDraft(null);
    } catch (e) {
      reportError(e, "Σφάλμα αποθήκευσης τιμής");
    }
  };

  const addMonths = async () => {
    if (!vehicle) return;
    const year = Number(monthsYear);
    const rate = Number(monthsRate);
    if (!year || !(rate > 0)) {
      toast.error("Συμπληρώστε έτος και τιμή");
      return;
    }
    const rows = MONTHS.map((name, m) => ({
      vehicle_id: vehicle.id,
      label: `${name} ${year}`,
      start_date: iso(new Date(year, m, 1)),
      end_date: iso(new Date(year, m + 1, 0)),
      daily_rate: rate,
      min_days: 1,
    }));
    await insertFree(rows, "Προστέθηκαν μήνες");
    setMonthsOpen(false);
  };

  const copyYearForward = async (year: number) => {
    if (!vehicle) return;
    const source = rates.filter((r) => r.start_date.startsWith(String(year)));
    const rows = source.map((r) => ({
      vehicle_id: vehicle.id,
      label: r.label ? r.label.replace(String(year), String(year + 1)) : null,
      start_date: shiftYear(r.start_date, 1),
      end_date: shiftYear(r.end_date, 1),
      daily_rate: Number(r.daily_rate),
      min_days: r.min_days,
    }));
    await insertFree(rows, `Αντιγράφηκαν στο ${year + 1}`);
  };

  const copyFromVehicle = async () => {
    if (!vehicle || !copyFromId) return;
    const today = iso(new Date());
    const rows = allRates
      .filter((r) => r.vehicle_id === copyFromId && r.end_date >= today)
      .map((r) => ({
        vehicle_id: vehicle.id,
        label: r.label,
        start_date: r.start_date,
        end_date: r.end_date,
        daily_rate: Number(r.daily_rate),
        min_days: r.min_days,
      }));
    await insertFree(rows, "Αντιγράφηκαν περίοδοι");
    setCopyFromId(null);
  };

  const saveListing = async () => {
    if (!vehicle) return;
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    try {
      await updateVehicle.mutateAsync({ id: vehicle.id, slug: clean || null, show_on_site: showOnSite });
      setSlug(clean);
      toast.success("Η εμφάνιση στο site ενημερώθηκε");
    } catch {
      toast.error("Το slug χρησιμοποιείται ήδη από άλλο όχημα");
    }
  };

  if (loadingVehicles || loadingRates) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 text-center">
        <p className="text-muted-foreground">Το όχημα δεν βρέθηκε.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/fleet")}>
          Πίσω στον στόλο
        </Button>
      </div>
    );
  }

  const lastYear = byYear.length ? byYear[byYear.length - 1][0] : null;
  const units = vehicle.quantity ?? 1;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <button
        onClick={() => navigate(`/fleet?vehicle=${vehicle.id}`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Στόλος
      </button>

      <PageHeader
        title={`Τιμές · ${vehicle.name}`}
        subtitle={`${units} ${units === 1 ? "μονάδα" : "μονάδες"} · η ίδια τιμή ισχύει για όλες τις μονάδες του μοντέλου`}
        actions={
          <Button className="rounded-full px-5 gap-1.5" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="h-4 w-4" />
            Νέα περίοδος
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Σήμερα</p>
          <p className="mt-1 text-[28px] leading-none font-bold tracking-tight">
            {todayRate ? `€${Number(todayRate.daily_rate)}` : "–"}
            {todayRate ? <span className="ml-1 text-sm font-medium text-muted-foreground">/ ημέρα</span> : null}
          </p>
          {!todayRate ? <p className="mt-1 text-xs text-destructive">Χωρίς τιμή για σήμερα</p> : null}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Περίοδοι</p>
          <p className="mt-1 text-[28px] leading-none font-bold tracking-tight">{rates.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Κενά χωρίς τιμή</p>
          <p className={`mt-1 text-[28px] leading-none font-bold tracking-tight ${gaps.length ? "text-destructive" : ""}`}>
            {gaps.length}
          </p>
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Ημέρες χωρίς τιμή</p>
          <p className="mt-1 text-muted-foreground">
            Αυτές οι ημέρες δεν μπορούν να τιμολογηθούν στο site:{" "}
            {gaps.slice(0, 4).map((g) => `${fmt(g.start)} – ${fmt(g.end)}`).join(", ")}
            {gaps.length > 4 ? ` και ${gaps.length - 4} ακόμη` : ""}
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => setMonthsOpen(true)}>
          <CalendarRange className="h-4 w-4" />
          Τιμές ανά μήνα
        </Button>
        {lastYear !== null && (
          <Button variant="outline" className="gap-1.5" onClick={() => void copyYearForward(lastYear)}>
            <Copy className="h-4 w-4" />
            Αντιγραφή {lastYear} → {lastYear + 1}
          </Button>
        )}
        <select
          value=""
          onChange={(e) => setCopyFromId(e.target.value || null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Αντιγραφή από άλλο όχημα"
        >
          <option value="">Αντιγραφή από άλλο όχημα…</option>
          {vehicles
            .filter((v) => v.id !== vehicle.id && allRates.some((r) => r.vehicle_id === v.id))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </div>

      {rates.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <CalendarRange className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-xl font-bold tracking-tight">Δεν υπάρχουν τιμές ακόμη</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Προσθέστε περιόδους (π.χ. Υψηλή περίοδος 11/7–10/9) ή γρήγορα μία τιμή ανά μήνα.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {byYear.map(([year, rows]) => (
            <section key={year}>
              <h2 className="mb-3 border-b pb-2 text-lg font-semibold">{year}</h2>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Περίοδος</th>
                      <th className="px-4 py-2.5 font-medium">Ημερομηνίες</th>
                      <th className="px-4 py-2.5 font-medium text-right">€ / ημέρα</th>
                      <th className="hidden px-4 py-2.5 font-medium text-right sm:table-cell">Ελάχ. ημέρες</th>
                      <th className="w-24 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{r.label || "Περίοδος"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {format(parseISO(r.start_date), "d MMM", { locale: el })} –{" "}
                          {format(parseISO(r.end_date), "d MMM", { locale: el })}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">€{Number(r.daily_rate)}</td>
                        <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.min_days}</td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="Επεξεργασία"
                            onClick={() =>
                              setDraft({
                                id: r.id,
                                label: r.label ?? "",
                                start: r.start_date,
                                end: r.end_date,
                                rate: String(Number(r.daily_rate)),
                                minDays: String(r.min_days),
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            aria-label="Διαγραφή"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="mt-10 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Εμφάνιση στο rentacarsifnos.com</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Οι τιμές και η διαθεσιμότητα εμφανίζονται στη σελίδα του οχήματος με αυτό το slug. Αλλαγές φαίνονται στο site μέσα σε λίγα λεπτά.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug στο site</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="π.χ. fiat-panda" />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={showOnSite} onCheckedChange={setShowOnSite} />
            Εμφάνιση στο site
          </label>
          <Button variant="outline" onClick={() => void saveListing()} disabled={updateVehicle.isPending}>
            Αποθήκευση
          </Button>
        </div>
      </section>

      <ResponsiveDialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{draft?.id ? "Επεξεργασία περιόδου" : "Νέα περίοδος τιμής"}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Όνομα (προαιρετικό)</Label>
                <Input
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="π.χ. Υψηλή περίοδος 2027"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Από</Label>
                  <Input type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Έως (μαζί)</Label>
                  <Input
                    type="date"
                    value={draft.end}
                    min={draft.start || undefined}
                    onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Τιμή / ημέρα (€)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={draft.rate}
                    onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ελάχιστες ημέρες</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={draft.minDays}
                    onChange={(e) => setDraft({ ...draft, minDays: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button onClick={() => void saveDraft()} disabled={createRates.isPending || updateRate.isPending}>
              Αποθήκευση
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Ακύρωση
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={monthsOpen} onOpenChange={setMonthsOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Τιμές ανά μήνα</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <p className="text-sm text-muted-foreground">
            Δημιουργεί 12 περιόδους (μία για κάθε μήνα) με την ίδια τιμή. Μετά αλλάζετε όποιον μήνα θέλετε. Μήνες που
            επικαλύπτουν υπάρχουσες περιόδους παραλείπονται.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Έτος</Label>
              <Input type="number" value={monthsYear} onChange={(e) => setMonthsYear(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Τιμή / ημέρα (€)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={monthsRate}
                onChange={(e) => setMonthsRate(e.target.value)}
              />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button onClick={() => void addMonths()} disabled={createRates.isPending}>
              Δημιουργία
            </Button>
            <Button variant="outline" onClick={() => setMonthsOpen(false)}>
              Ακύρωση
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmSheet
        open={copyFromId !== null}
        onOpenChange={(open) => !open && setCopyFromId(null)}
        title="Αντιγραφή τιμών"
        description={`Αντιγραφή των μελλοντικών περιόδων από ${
          vehicles.find((v) => v.id === copyFromId)?.name ?? ""
        } στο ${vehicle.name}; Περίοδοι που επικαλύπτονται παραλείπονται.`}
        confirmLabel="Αντιγραφή"
        onConfirm={() => void copyFromVehicle()}
      />

      <ConfirmSheet
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Διαγραφή περιόδου"
        description="Οι ημέρες αυτής της περιόδου θα μείνουν χωρίς τιμή."
        confirmLabel="Διαγραφή"
        onConfirm={() => {
          if (!deleteId) return;
          deleteRate.mutate(deleteId, {
            onSuccess: () => toast.success("Η περίοδος διαγράφηκε"),
            onError: () => toast.error("Σφάλμα διαγραφής"),
          });
          setDeleteId(null);
        }}
      />
    </div>
  );
}
