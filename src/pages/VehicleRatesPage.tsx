import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  Copy,
  Globe,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { MONTHS_LONG, PRICE_SWATCHES, euro, priceScale } from "@/components/fleet/fleetData";
import { ModelPhoto } from "@/components/fleet/FleetModelCard";
import { PriceLegend, PriceYearCalendar, YearPriceStrip } from "@/components/fleet/PriceVisuals";

const MONTHS = MONTHS_LONG;

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
const fmtShort = (day: string) => format(parseISO(day), "d MMM", { locale: el });
const spanDays = (start: string, end: string) => differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;

function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
      <p className={cn("mt-2 text-[26px] font-bold leading-none tracking-tight tabular-nums sm:text-[30px]", tone)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

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
  const thisYear = new Date().getFullYear();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [monthsYear, setMonthsYear] = useState(String(thisYear + 1));
  const [monthsRate, setMonthsRate] = useState("");
  const [copyFromId, setCopyFromId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [showOnSite, setShowOnSite] = useState(true);
  const [year, setYear] = useState(thisYear);
  const [pendingStart, setPendingStart] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicle) return;
    setSlug(vehicle.slug ?? "");
    setShowOnSite(vehicle.show_on_site ?? true);
  }, [vehicle]);

  const years = useMemo(() => {
    const set = new Set<number>([thisYear, thisYear + 1, ...byYear.map(([y]) => y)]);
    return [...set].sort((a, b) => a - b);
  }, [byYear, thisYear]);

  const yearRates = useMemo(
    () => rates.filter((r) => r.start_date <= `${year}-12-31` && r.end_date >= `${year}-01-01`),
    [rates, year],
  );
  const yearScale = useMemo(() => priceScale(yearRates), [yearRates]);
  const yearPricedDays = useMemo(() => {
    let n = 0;
    const total = differenceInCalendarDays(new Date(year + 1, 0, 1), new Date(year, 0, 1));
    for (let i = 0; i < total; i++) if (rateForDay(yearRates, iso(addDays(new Date(year, 0, 1), i)))) n++;
    return { n, total };
  }, [yearRates, year]);

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

  const editRate = (r: VehicleRate) =>
    setDraft({
      id: r.id,
      label: r.label ?? "",
      start: r.start_date,
      end: r.end_date,
      rate: String(Number(r.daily_rate)),
      minDays: String(r.min_days),
    });

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
    const y = Number(monthsYear);
    const rate = Number(monthsRate);
    if (!y || !(rate > 0)) {
      toast.error("Συμπληρώστε έτος και τιμή");
      return;
    }
    const rows = MONTHS.map((name, m) => ({
      vehicle_id: vehicle.id,
      label: `${name} ${y}`,
      start_date: iso(new Date(y, m, 1)),
      end_date: iso(new Date(y, m + 1, 0)),
      daily_rate: rate,
      min_days: 1,
    }));
    await insertFree(rows, "Προστέθηκαν μήνες");
    setMonthsOpen(false);
    setYear(y);
  };

  const copyYearForward = async (from: number) => {
    if (!vehicle) return;
    const source = rates.filter((r) => r.start_date.startsWith(String(from)));
    const rows = source.map((r) => ({
      vehicle_id: vehicle.id,
      label: r.label ? r.label.replace(String(from), String(from + 1)) : null,
      start_date: shiftYear(r.start_date, 1),
      end_date: shiftYear(r.end_date, 1),
      daily_rate: Number(r.daily_rate),
      min_days: r.min_days,
    }));
    await insertFree(rows, `Αντιγράφηκαν στο ${from + 1}`);
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

  /** Calendar: priced day edits its period; an empty day starts a range, the next click ends it. */
  const onDayClick = (day: string, rate: VehicleRate | undefined) => {
    if (pendingStart) {
      const [start, end] = pendingStart <= day ? [pendingStart, day] : [day, pendingStart];
      setPendingStart(null);
      setDraft({ ...EMPTY_DRAFT, start, end });
      return;
    }
    if (rate) editRate(rate);
    else setPendingStart(day);
  };

  if (loadingVehicles || loadingRates) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-4 px-4 py-6 sm:px-6 lg:px-10">
        <Skeleton className="h-16 w-80 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8">
        <p className="text-muted-foreground">Το όχημα δεν βρέθηκε.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/fleet")}>
          Πίσω στον στόλο
        </Button>
      </div>
    );
  }

  const units = vehicle.quantity ?? 1;
  const copySources = vehicles.filter((v) => v.id !== vehicle.id && allRates.some((r) => r.vehicle_id === v.id));
  const draftOverlap =
    draft && draft.start && draft.end
      ? rates.find((r) => r.id !== draft.id && overlaps(r, { start_date: draft.start, end_date: draft.end }))
      : undefined;
  const draftDays = draft && draft.start && draft.end && draft.end >= draft.start ? spanDays(draft.start, draft.end) : 0;
  const coverage = yearPricedDays.total ? Math.round((yearPricedDays.n / yearPricedDays.total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 md:py-8 lg:px-10">
      <button
        onClick={() => navigate(`/fleet?vehicle=${vehicle.id}`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Στόλος
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <ModelPhoto summary={{ vehicle }} className="h-16 w-24 shrink-0 rounded-xl border sm:h-20 sm:w-32" iconClassName="h-7 w-7" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Τιμές ανά περίοδο</p>
            <h1 className="truncate font-display text-[26px] font-bold leading-tight tracking-[-0.025em] md:text-[36px]">
              {vehicle.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {units} {units === 1 ? "μονάδα" : "μονάδες"} · η ίδια τιμή ισχύει για όλες τις μονάδες του μοντέλου
            </p>
          </div>
        </div>
        <Button className="gap-1.5 rounded-full px-5" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          <Plus className="h-4 w-4" />
          Νέα περίοδος
        </Button>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Σήμερα"
          value={
            todayRate ? (
              <>
                {euro(todayRate.daily_rate)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">/ ημέρα</span>
              </>
            ) : (
              "–"
            )
          }
          hint={todayRate ? todayRate.label || "Περίοδος" : <span className="text-destructive">Χωρίς τιμή για σήμερα</span>}
        />
        <Kpi
          label={`Εύρος ${year}`}
          value={yearRates.length ? (yearScale.min === yearScale.max ? euro(yearScale.min) : `${euro(yearScale.min)}–${Number(yearScale.max)}`) : "–"}
          hint={`${yearRates.length} ${yearRates.length === 1 ? "περίοδος" : "περίοδοι"} · σύνολο ${rates.length}`}
        />
        <Kpi
          label={`Κάλυψη ${year}`}
          value={`${coverage}%`}
          hint={`${yearPricedDays.n} από ${yearPricedDays.total} ημέρες με τιμή`}
          tone={coverage < 100 ? "text-warning" : "text-success"}
        />
        <Kpi
          label="Κενά χωρίς τιμή"
          value={gaps.length}
          hint={gaps.length ? `πρώτο: ${fmtShort(gaps[0].start)}` : "από σήμερα και μετά"}
          tone={gaps.length ? "text-destructive" : undefined}
        />
      </div>

      {gaps.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="font-semibold text-destructive">Ημέρες χωρίς τιμή</p>
            <p className="mt-1 text-muted-foreground">
              Αυτές οι ημέρες δεν μπορούν να τιμολογηθούν στο site:{" "}
              {gaps.slice(0, 4).map((g) => `${fmt(g.start)} – ${fmt(g.end)}`).join(", ")}
              {gaps.length > 4 ? ` και ${gaps.length - 4} ακόμη` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gaps.slice(0, 4).map((g) => (
                <button
                  key={g.start}
                  type="button"
                  onClick={() => setDraft({ ...EMPTY_DRAFT, start: g.start, end: g.end })}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-destructive/30 bg-background px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Plus className="h-3 w-3" />
                  {fmtShort(g.start)} – {fmtShort(g.end)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Season strip */}
          <section className="rounded-2xl border bg-card p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Σεζόν {year}</h2>
                <p className="text-sm text-muted-foreground">Ύψος και χρώμα κάθε στήλης ακολουθούν την τιμή. Πατήστε για επεξεργασία.</p>
              </div>
              <div className="segmented inline-flex self-start overflow-x-auto" role="tablist" aria-label="Έτος">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    role="tab"
                    aria-selected={y === year}
                    data-state={y === year ? "active" : "inactive"}
                    onClick={() => {
                      setYear(y);
                      setPendingStart(null);
                    }}
                    className={cn(
                      "segmented-item px-3.5 text-sm font-semibold tabular-nums",
                      y === year ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-3">
              <YearPriceStrip rates={rates} year={year} onSelect={editRate} />
            </div>
            <div className="mt-4">
              <PriceLegend rates={rates} year={year} />
            </div>
          </section>

          {/* Calendar */}
          <section className="rounded-2xl border bg-card p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Ημερολόγιο τιμών {year}</h2>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
                  Ημέρα με τιμή: επεξεργασία. Κενή ημέρα: επιλέξτε αρχή και τέλος νέας περιόδου.
                </p>
              </div>
            </div>
            {pendingStart && (
              <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm backdrop-blur">
                <span className="font-medium">
                  Από {fmt(pendingStart)}. Επιλέξτε ημέρα λήξης.
                </span>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setDraft({ ...EMPTY_DRAFT, start: pendingStart, end: pendingStart });
                      setPendingStart(null);
                    }}
                  >
                    Μόνο αυτή η ημέρα
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Ακύρωση" onClick={() => setPendingStart(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <PriceYearCalendar rates={rates} year={year} pendingStart={pendingStart} onDayClick={onDayClick} />
          </section>

          {/* Periods grouped by year */}
          {rates.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
              <CalendarRange className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 text-xl font-bold tracking-tight">Δεν υπάρχουν τιμές ακόμη</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Προσθέστε περιόδους (π.χ. Υψηλή περίοδος 11/7–10/9) ή γρήγορα μία τιμή ανά μήνα.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button className="gap-1.5 rounded-full" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
                  <Plus className="h-4 w-4" />
                  Νέα περίοδος
                </Button>
                <Button variant="outline" className="gap-1.5 rounded-full" onClick={() => setMonthsOpen(true)}>
                  <CalendarRange className="h-4 w-4" />
                  Τιμές ανά μήνα
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {byYear.map(([y, rows]) => {
                const scale = priceScale(rows);
                return (
                  <section key={y} className="rounded-2xl border bg-card">
                    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
                      <h2 className="text-lg font-semibold tabular-nums">{y}</h2>
                      <span className="text-sm text-muted-foreground">
                        {rows.length} {rows.length === 1 ? "περίοδος" : "περίοδοι"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-8 gap-1.5 text-xs"
                        onClick={() => void copyYearForward(y)}
                        disabled={createRates.isPending}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Αντιγραφή {y} → {y + 1}
                      </Button>
                    </div>
                    <div className="hidden grid-cols-[16px_minmax(0,1.3fr)_minmax(0,1.4fr)_110px_100px_88px] items-center gap-4 border-b bg-muted/40 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                      <span />
                      <span>Περίοδος</span>
                      <span>Ημερομηνίες</span>
                      <span className="text-right">€ / ημέρα</span>
                      <span className="text-right">Ελάχ. ημέρες</span>
                      <span />
                    </div>
                    <div className="divide-y">
                      {rows.map((r) => {
                        const days = spanDays(r.start_date, r.end_date);
                        const today = iso(new Date());
                        const live = r.start_date <= today && r.end_date >= today;
                        return (
                          <div
                            key={r.id}
                            className="grid grid-cols-[16px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-3 sm:px-5 md:grid-cols-[16px_minmax(0,1.3fr)_minmax(0,1.4fr)_110px_100px_88px] md:gap-4"
                          >
                            <span className={cn("h-4 w-4 rounded-md border", PRICE_SWATCHES[scale.tierOf(Number(r.daily_rate))])} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {r.label || "Περίοδος"}
                                {live && (
                                  <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                                    τώρα
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted-foreground md:hidden">
                                {fmtShort(r.start_date)} – {fmtShort(r.end_date)} · {days} ημ. · ελάχ. {r.min_days}
                              </p>
                            </div>
                            <p className="hidden text-sm text-muted-foreground md:block">
                              {fmtShort(r.start_date)} – {fmtShort(r.end_date)}
                              <span className="ml-1.5 text-xs">· {days} ημ.</span>
                            </p>
                            <p className="text-right text-base font-bold tabular-nums md:text-sm">{euro(r.daily_rate)}</p>
                            <p className="hidden text-right text-sm tabular-nums md:block">{r.min_days}</p>
                            <div className="-mr-2 flex justify-end">
                              <Button size="icon" variant="ghost" className="h-8 w-8 coarse:h-10 coarse:w-10" aria-label="Επεξεργασία" onClick={() => editRate(r)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive coarse:h-10 coarse:w-10"
                                aria-label="Διαγραφή"
                                onClick={() => setDeleteId(r.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Right rail: tools + site */}
        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold">Γρήγορες ενέργειες</h2>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setMonthsOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <CalendarRange className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Τιμές ανά μήνα</span>
                  <span className="block text-xs text-muted-foreground">12 περίοδοι με μία κίνηση</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void copyYearForward(year)}
                disabled={!byYear.some(([y]) => y === year) || createRates.isPending}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Copy className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    Αντιγραφή {year} → {year + 1}
                  </span>
                  <span className="block text-xs text-muted-foreground">Ίδιες ημερομηνίες και τιμές, επόμενο έτος</span>
                </span>
              </button>
              <div className="rounded-xl border p-3">
                <Label className="text-sm font-semibold">Αντιγραφή από άλλο όχημα</Label>
                <p className="mb-2 text-xs text-muted-foreground">Μόνο μελλοντικές περίοδοι, χωρίς επικαλύψεις.</p>
                <Select value="" onValueChange={(v) => setCopyFromId(v || null)} disabled={copySources.length === 0}>
                  <SelectTrigger className="h-9" aria-label="Αντιγραφή από άλλο όχημα">
                    <SelectValue placeholder={copySources.length ? "Επιλέξτε μοντέλο…" : "Κανένα άλλο μοντέλο με τιμές"} />
                  </SelectTrigger>
                  <SelectContent>
                    {copySources.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Εμφάνιση στο rentacarsifnos.com</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Οι τιμές και η διαθεσιμότητα εμφανίζονται στη σελίδα του οχήματος με αυτό το slug. Αλλαγές φαίνονται στο site μέσα σε λίγα λεπτά.
            </p>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug στο site</Label>
                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <span className="pl-3 text-sm text-muted-foreground">/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="π.χ. fiat-panda"
                    className="border-0 pl-1 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <span>
                  <span className="block font-medium">Εμφάνιση στο site</span>
                  <span className="block text-xs text-muted-foreground">{showOnSite ? "Ορατό και κρατήσιμο online" : "Κρυφό από τους επισκέπτες"}</span>
                </span>
                <Switch checked={showOnSite} onCheckedChange={setShowOnSite} />
              </label>
              <Button variant="outline" className="w-full" onClick={() => void saveListing()} disabled={updateVehicle.isPending}>
                Αποθήκευση
              </Button>
            </div>
          </section>
        </aside>
      </div>

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
              {draftDays > 0 && (
                <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                  <span className="font-semibold tabular-nums">{draftDays}</span>{" "}
                  <span className="text-muted-foreground">{draftDays === 1 ? "ημέρα" : "ημέρες"}</span>
                  {Number(draft.rate) > 0 && (
                    <span className="text-muted-foreground">
                      {" · "}π.χ. εβδομάδα <span className="font-semibold text-foreground">{euro(Number(draft.rate) * 7)}</span>
                    </span>
                  )}
                </div>
              )}
              {draftOverlap && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Επικαλύπτει «{draftOverlap.label || "Περίοδος"}» ({fmtShort(draftOverlap.start_date)} – {fmtShort(draftOverlap.end_date)}).
                </p>
              )}
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button onClick={() => void saveDraft()} disabled={createRates.isPending || updateRate.isPending}>
              Αποθήκευση
            </Button>
            {draft?.id && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setDeleteId(draft.id!);
                  setDraft(null);
                }}
              >
                Διαγραφή
              </Button>
            )}
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
