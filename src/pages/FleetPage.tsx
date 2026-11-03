import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { startOfDay } from "date-fns";
import {
  AlertTriangle,
  Bike,
  Car,
  CarFront,
  KeyRound,
  LayoutGrid,
  List,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useVehicles } from "@/hooks/useVehicles";
import { useBookings } from "@/hooks/useBookings";
import { useVehicleBlocks } from "@/hooks/useVehicleBlocks";
import { useVehicleRates } from "@/hooks/useVehicleRates";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { summarizeModel, type ModelSummary } from "@/components/fleet/fleetData";
import { FleetModelCard, FleetModelRow } from "@/components/fleet/FleetModelCard";
import { FleetModelDetail, type DetailTab } from "@/components/fleet/FleetModelDetail";

type TypeFilter = "all" | "car" | "scooter";
type StatusFilter = "all" | "free" | "full" | "blocked" | "unpriced" | "offsite";
type SortKey = "name" | "free" | "price";
type ViewMode = "grid" | "list";

const VIEW_KEY = "artemis.fleet.view";

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

const STATUS_FILTERS: { key: StatusFilter; label: string; test: (s: ModelSummary) => boolean }[] = [
  { key: "all", label: "Όλα", test: () => true },
  { key: "free", label: "Με ελεύθερα", test: (s) => s.free > 0 },
  { key: "full", label: "Πλήρη σήμερα", test: (s) => s.free === 0 && !s.activeBlock },
  { key: "blocked", label: "Σε συντήρηση", test: (s) => Boolean(s.activeBlock) },
  { key: "unpriced", label: "Χωρίς τιμή", test: (s) => !s.todayRate },
  { key: "offsite", label: "Εκτός site", test: (s) => !s.vehicle.show_on_site },
];

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  children,
  onClick,
}: {
  icon: typeof Car;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "success" | "primary" | "destructive" | "warning";
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const toneCls = {
    success: "bg-success/15 text-success",
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning",
  }[tone ?? "primary"];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="pressable flex flex-col rounded-2xl border bg-card p-4 text-left transition-colors enabled:hover:bg-muted/30 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneCls)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tracking-tight tabular-nums sm:text-[32px]">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      {children}
    </button>
  );
}

export default function FleetPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("vehicle");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: bookings = [] } = useBookings();
  const { data: blocks = [] } = useVehicleBlocks();
  const { data: rates = [] } = useVehicleRates();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<ViewMode>(readView);
  const [tab, setTab] = useState<DetailTab>("overview");

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* private mode */
    }
  }, [view]);

  const summaries = useMemo(() => {
    const today = startOfDay(new Date());
    return vehicles.map((v) => summarizeModel(v, bookings, blocks, rates, today));
  }, [vehicles, bookings, blocks, rates]);

  const totals = useMemo(() => {
    const t = { units: 0, free: 0, onRent: 0, blocked: 0, car: 0, scooter: 0, unpriced: 0, blockedModels: 0 };
    for (const s of summaries) {
      t.units += s.total;
      t.free += s.free;
      t.onRent += s.onRent;
      t.blocked += s.blocked;
      if (s.vehicle.type === "car") t.car += s.total;
      if (s.vehicle.type === "scooter") t.scooter += s.total;
      if (!s.todayRate) t.unpriced++;
      if (s.activeBlock) t.blockedModels++;
    }
    return t;
  }, [summaries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const statusTest = STATUS_FILTERS.find((f) => f.key === statusFilter)!.test;
    const list = summaries.filter(
      (s) =>
        (typeFilter === "all" || s.vehicle.type === typeFilter) &&
        statusTest(s) &&
        (!q || s.vehicle.name.toLowerCase().includes(q) || s.plates.some((p) => p.toLowerCase().includes(q))),
    );
    return list.sort((a, b) => {
      if (sort === "free") return b.free - a.free || a.vehicle.name.localeCompare(b.vehicle.name);
      if (sort === "price")
        return Number(b.todayRate?.daily_rate ?? -1) - Number(a.todayRate?.daily_rate ?? -1);
      return a.vehicle.name.localeCompare(b.vehicle.name, "el");
    });
  }, [summaries, typeFilter, statusFilter, query, sort]);

  const selected = summaries.find((s) => s.vehicle.id === selectedId) ?? null;

  const openVehicle = (id: string) => {
    setTab("overview");
    const next = new URLSearchParams(params);
    next.set("vehicle", id);
    setParams(next, { replace: true });
  };
  const closeVehicle = () => {
    const next = new URLSearchParams(params);
    next.delete("vehicle");
    setParams(next, { replace: true });
  };

  const freePct = totals.units ? Math.round((totals.free / totals.units) * 100) : 0;
  const filtersActive = typeFilter !== "all" || statusFilter !== "all" || query.trim() !== "";

  const detail = selected && (
    <FleetModelDetail
      key={selected.vehicle.id}
      summary={selected}
      bookings={bookings}
      blocks={blocks}
      rates={rates}
      onClose={closeVehicle}
      tab={tab}
      onTabChange={setTab}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 md:py-8 lg:px-10">
      <PageHeader
        title="Στόλος"
        subtitle={`${totals.units} οχήματα · ${vehicles.length} μοντέλα · ${totals.car} αυτοκίνητα, ${totals.scooter} scooters`}
        actions={
          <Button onClick={() => navigate("/fleet/new")} className="gap-1.5 rounded-full px-5">
            <Plus className="h-4 w-4" />
            Προσθήκη οχήματος
          </Button>
        }
      />

      {/* KPIs */}
      {isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            icon={KeyRound}
            label="Ελεύθερα σήμερα"
            tone="success"
            value={
              <>
                {totals.free}
                <span className="text-base font-semibold text-muted-foreground">/{totals.units}</span>
              </>
            }
            onClick={() => setStatusFilter("free")}
          >
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${freePct}%` }} />
            </div>
          </KpiTile>
          <KpiTile
            icon={CarFront}
            label="Σε ενοικίαση"
            value={totals.onRent}
            sub={totals.units ? `${Math.round((totals.onRent / totals.units) * 100)}% πληρότητα` : undefined}
            onClick={() => setStatusFilter("full")}
          />
          <KpiTile
            icon={Wrench}
            label="Σε συντήρηση"
            tone={totals.blocked ? "destructive" : "primary"}
            value={totals.blocked}
            sub={totals.blockedModels ? `${totals.blockedModels} μοντέλα μπλοκαρισμένα` : "Κανένα μπλοκ σήμερα"}
            onClick={() => setStatusFilter("blocked")}
          />
          <KpiTile
            icon={AlertTriangle}
            label="Χωρίς τιμή σήμερα"
            tone={totals.unpriced ? "warning" : "success"}
            value={totals.unpriced}
            sub={totals.unpriced ? "μοντέλα δεν τιμολογούνται" : "Όλα τα μοντέλα έχουν τιμή"}
            onClick={() => setStatusFilter("unpriced")}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Μοντέλο ή πινακίδα"
              className="h-10 rounded-full pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Καθαρισμός"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="segmented inline-flex flex-1 md:flex-none" role="tablist" aria-label="Τύπος οχήματος">
              {(
                [
                  { key: "all", label: "Όλα", icon: LayoutGrid, count: totals.units },
                  { key: "car", label: "Αυτοκίνητα", icon: Car, count: totals.car },
                  { key: "scooter", label: "Scooters", icon: Bike, count: totals.scooter },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = typeFilter === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-state={active ? "active" : "inactive"}
                    onClick={() => setTypeFilter(t.key)}
                    className={cn(
                      "segmented-item flex flex-1 items-center justify-center gap-1.5 px-3 text-xs font-semibold transition-colors md:flex-none",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="hidden h-3.5 w-3.5 sm:block" />
                    {t.label}
                    <span className="tabular-nums opacity-60">{t.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              <Select value={sort} onValueChange={(s) => setSort(s as SortKey)}>
                <SelectTrigger className="h-9 w-[190px] rounded-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Ταξινόμηση: Όνομα</SelectItem>
                  <SelectItem value="free">Ταξινόμηση: Ελεύθερα</SelectItem>
                  <SelectItem value="price">Ταξινόμηση: Τιμή σήμερα</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center rounded-full border p-0.5 md:ml-0">
              {(
                [
                  ["grid", LayoutGrid, "Κάρτες"],
                  ["list", List, "Λίστα"],
                ] as const
              ).map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          {STATUS_FILTERS.map((f) => {
            const count = f.key === "all" ? summaries.length : summaries.filter(f.test).length;
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors coarse:h-10 coarse:px-4",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {f.label}
                <span className={cn("tabular-nums", active ? "opacity-80" : "opacity-60")}>{count}</span>
              </button>
            );
          })}
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter("all");
                setStatusFilter("all");
                setQuery("");
              }}
              className="inline-flex h-8 shrink-0 items-center px-2 text-xs font-medium text-primary hover:underline coarse:h-10"
            >
              Καθαρισμός φίλτρων
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[360px] rounded-2xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Car className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight">Ο στόλος είναι άδειος</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Πατήστε «Προσθήκη οχήματος» για να ξεκινήσετε με το πρώτο μοντέλο.
          </p>
          <Button className="mt-5 gap-1.5 rounded-full" onClick={() => navigate("/fleet/new")}>
            <Plus className="h-4 w-4" />
            Προσθήκη οχήματος
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          Κανένα μοντέλο δεν ταιριάζει με τα φίλτρα.
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((s) => (
            <FleetModelCard key={s.vehicle.id} summary={s} onOpen={() => openVehicle(s.vehicle.id)} />
          ))}
          <button
            type="button"
            onClick={() => navigate("/fleet/new")}
            className="pressable flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold">Νέο μοντέλο ή μονάδες</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="hidden grid-cols-[64px_minmax(180px,1.4fr)_minmax(140px,1fr)_minmax(160px,1.2fr)_90px_minmax(140px,1fr)_132px_20px] gap-3 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span />
            <span>Μοντέλο</span>
            <span>Μονάδες σήμερα</span>
            <span>Πινακίδες</span>
            <span className="text-right">Σήμερα</span>
            <span>Επόμενη κράτηση</span>
            <span>Κατάσταση</span>
            <span />
          </div>
          <div className="divide-y">
            {visible.map((s) => (
              <FleetModelRow key={s.vehicle.id} summary={s} onOpen={() => openVehicle(s.vehicle.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Model detail: right sheet on desktop, bottom drawer on mobile */}
      {isMobile ? (
        <Drawer open={Boolean(selected)} onOpenChange={(open) => !open && closeVehicle()}>
          <DrawerContent className="max-h-[94vh]">
            <DrawerTitle className="sr-only">{selected?.vehicle.name ?? "Όχημα"}</DrawerTitle>
            {detail}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && closeVehicle()}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[580px] [&>button]:hidden">
            <SheetTitle className="sr-only">{selected?.vehicle.name ?? "Όχημα"}</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
