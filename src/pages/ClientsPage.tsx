import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowDownUp,
  CalendarClock,
  CircleDollarSign,
  Download,
  Euro,
  Languages,
  Plus,
  Repeat,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";
import { useBookings } from "@/hooks/useBookings";
import { cn } from "@/lib/utils";
import { ClientsTable, type ClientRow } from "@/components/clients/ClientsTable";
import { ClientCardList } from "@/components/clients/ClientCardList";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";
import {
  EMPTY_STATS,
  SORT_LABELS,
  computeStatsByClient,
  formatEuro,
  languageLabel,
  normalizeLanguage,
  type SortKey,
  type SortState,
} from "@/components/clients/clientUtils";

type View = "all" | "balance" | "returning" | "upcoming" | "none";

const VIEWS: { id: View; label: string; test: (r: ClientRow) => boolean }[] = [
  { id: "all", label: "Όλοι", test: () => true },
  { id: "balance", label: "Με υπόλοιπο", test: (r) => r.stats.balance > 0 },
  { id: "returning", label: "Επαναλαμβανόμενοι", test: (r) => r.stats.count >= 2 },
  { id: "upcoming", label: "Επερχόμενες", test: (r) => !!r.stats.nextRental },
  { id: "none", label: "Χωρίς κράτηση", test: (r) => r.stats.count === 0 },
];

const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  name: "asc",
  bookings: "desc",
  ltv: "desc",
  balance: "desc",
  last: "desc",
};

function compareRows(a: ClientRow, b: ClientRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.client.name.localeCompare(b.client.name, "el");
    case "bookings":
      return a.stats.count - b.stats.count;
    case "ltv":
      return a.stats.ltv - b.stats.ltv;
    case "balance":
      return a.stats.balance - b.stats.balance;
    case "last": {
      const av = a.stats.nextRental ?? a.stats.lastRental ?? "";
      const bv = b.stats.nextRental ?? b.stats.lastRental ?? "";
      return av.localeCompare(bv);
    }
  }
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: ClientRow[]) {
  const header = ["Όνομα", "Τηλέφωνο", "Email", "Γλώσσα", "Κρατήσεις", "Αξία €", "Υπόλοιπο €", "Τελευταία ενοικίαση", "Επόμενη ενοικίαση", "Ετικέτες"];
  const lines = rows.map(({ client, stats }) =>
    [
      client.name,
      client.phone,
      client.email,
      client.preferred_language,
      stats.count,
      stats.ltv,
      stats.balance,
      stats.lastRental,
      stats.nextRental,
      (client.tags ?? []).join(" | "),
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pelates-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Kpi({
  icon,
  label,
  shortLabel,
  value,
  hint,
  tone,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  shortLabel?: string;
  value: string;
  hint?: string;
  tone?: "warning" | "accent";
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5 text-left md:px-5 md:py-4",
        onClick && "transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        active && "bg-muted",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">
          {shortLabel ? (
            <>
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
        </span>
      </span>
      <span
        className={cn(
          "truncate text-xl font-semibold tabular-nums tracking-tight text-foreground md:text-2xl",
          tone === "warning" && "text-warning",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </span>
      {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
    </Comp>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useClients();
  const { data: bookings = [] } = useBookings();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("all");
  const [language, setLanguage] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortState>({ key: "ltv", dir: "desc" });
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, like Attio / Linear
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statsByClient = useMemo(() => computeStatsByClient(bookings), [bookings]);

  const allRows = useMemo<ClientRow[]>(
    () => clients.map((client) => ({ client, stats: statsByClient.get(client.id) ?? EMPTY_STATS })),
    [clients, statsByClient],
  );

  const summary = useMemo(() => {
    const withBookings = allRows.filter((r) => r.stats.count > 0).length;
    const returning = allRows.filter((r) => r.stats.count >= 2).length;
    const revenue = allRows.reduce((s, r) => s + r.stats.ltv, 0);
    const openBalance = allRows.reduce((s, r) => s + r.stats.balance, 0);
    const owing = allRows.filter((r) => r.stats.balance > 0).length;
    return { withBookings, returning, revenue, openBalance, owing };
  }, [allRows]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) {
      const l = normalizeLanguage(c.preferred_language);
      if (l) set.add(l);
    }
    return [...set].sort();
  }, [clients]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) for (const t of c.tags ?? []) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "el"));
  }, [clients]);

  const searched = useMemo(() => {
    const q = search.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, "");
    return allRows.filter(({ client }) => {
      if (language !== "all" && normalizeLanguage(client.preferred_language) !== language) return false;
      if (tag !== "all" && !(client.tags ?? []).includes(tag)) return false;
      if (!q) return true;
      return (
        client.name.toLowerCase().includes(q) ||
        (!!qDigits && !!client.phone && client.phone.replace(/\D/g, "").includes(qDigits)) ||
        !!client.phone?.includes(q) ||
        !!client.email?.toLowerCase().includes(q) ||
        (client.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [allRows, search, language, tag]);

  const viewCounts = useMemo(() => {
    const out = {} as Record<View, number>;
    for (const v of VIEWS) out[v.id] = searched.filter(v.test).length;
    return out;
  }, [searched]);

  const rows = useMemo(() => {
    const test = VIEWS.find((v) => v.id === view)?.test ?? (() => true);
    const mult = sort.dir === "asc" ? 1 : -1;
    return searched
      .filter(test)
      .sort((a, b) => compareRows(a, b, sort.key) * mult || a.client.name.localeCompare(b.client.name, "el"));
  }, [searched, view, sort]);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }));

  const hasFilters = !!search || view !== "all" || language !== "all" || tag !== "all";
  const clearFilters = () => {
    setSearch("");
    setView("all");
    setLanguage("all");
    setTag("all");
  };

  const repeatRate = summary.withBookings ? Math.round((summary.returning / summary.withBookings) * 100) : 0;

  return (
    <div className="w-full px-4 py-5 md:px-8 md:py-8 2xl:px-12">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between md:mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-bold leading-9 tracking-[-0.025em] text-foreground md:text-[36px] md:leading-[1.1]">
            Πελάτες
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Φόρτωση…" : `${clients.length} στο CRM · ${summary.withBookings} με κρατήσεις`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden gap-1.5 sm:inline-flex"
            onClick={() => exportCsv(rows)}
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4" />
            Εξαγωγή
          </Button>
          <Button className="flex-1 gap-1.5 coarse:h-11 sm:flex-none" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Νέος πελάτης
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Kpi
          icon={<Users className="h-3.5 w-3.5" />}
          label="Πελάτες"
          value={String(clients.length)}
          hint={`${summary.withBookings} με τουλάχιστον μία κράτηση`}
          onClick={() => setView("all")}
          active={view === "all" && !hasFilters}
        />
        <Kpi
          icon={<Repeat className="h-3.5 w-3.5" />}
          label="Επαναλαμβανόμενοι"
          shortLabel="Επιστρέφουν"
          value={`${summary.returning}`}
          hint={`${repeatRate}% ποσοστό επιστροφής`}
          tone="accent"
          onClick={() => setView("returning")}
          active={view === "returning"}
        />
        <Kpi
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Συνολική αξία"
          value={formatEuro(summary.revenue)}
          hint={summary.withBookings ? `Μ.Ο. ${formatEuro(summary.revenue / summary.withBookings)} / πελάτη` : "—"}
        />
        <Kpi
          icon={<CircleDollarSign className="h-3.5 w-3.5" />}
          label="Ανοιχτά υπόλοιπα"
          shortLabel="Υπόλοιπα"
          value={formatEuro(summary.openBalance)}
          hint={summary.owing ? `${summary.owing} πελάτες χρωστούν` : "Όλα εξοφλημένα"}
          tone={summary.openBalance > 0 ? "warning" : undefined}
          onClick={() => setView("balance")}
          active={view === "balance"}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <div role="tablist" aria-label="Προβολές" className="inline-flex min-w-max items-center gap-1 rounded-lg bg-muted p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                type="button"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors coarse:h-9",
                  "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === v.id && "bg-card text-foreground shadow-[0_1px_3px_hsl(var(--foreground)/0.1)]",
                )}
              >
                {v.id === "balance" && <CircleDollarSign className="h-3.5 w-3.5 text-warning" />}
                {v.id === "upcoming" && <CalendarClock className="h-3.5 w-3.5 text-primary" />}
                {v.label}
                <span
                  className={cn(
                    "rounded px-1 text-[11px] tabular-nums",
                    view === v.id ? "bg-muted text-foreground" : "text-muted-foreground/80",
                  )}
                >
                  {viewCounts[v.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              placeholder="Όνομα, τηλέφωνο, email, ετικέτα…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-card pl-9 pr-9 coarse:h-11"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Καθαρισμός"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground md:inline-block">
                /
              </kbd>
            )}
          </div>

          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className={cn("h-9 w-auto min-w-[150px] gap-2 bg-card coarse:h-11", language !== "all" && "border-primary/40")}>
                <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι γλώσσες</SelectItem>
                {languages.map((l) => (
                  <SelectItem key={l} value={l}>
                    {languageLabel(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {tags.length > 0 && (
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger className={cn("h-9 w-auto min-w-[140px] gap-2 bg-card coarse:h-11", tag !== "all" && "border-primary/40")}>
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Όλες οι ετικέτες</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Mobile sort (desktop sorts via column headers) */}
            <Select
              value={`${sort.key}:${sort.dir}`}
              onValueChange={(v) => {
                const [key, dir] = v.split(":") as [SortKey, "asc" | "desc"];
                setSort({ key, dir });
              }}
            >
              <SelectTrigger className="h-9 w-auto min-w-[150px] gap-2 bg-card coarse:h-11 md:hidden">
                <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={`${k}:${k === sort.key ? sort.dir : DEFAULT_DIR[k]}`}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground coarse:h-11" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                Καθαρισμός
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-5 py-3 last:border-b-0">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto hidden h-4 w-24 md:block" />
              <Skeleton className="hidden h-4 w-16 md:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mb-1 font-display text-lg font-semibold">Δεν υπάρχουν πελάτες ακόμα</p>
          <p className="mb-5 text-sm text-muted-foreground">
            Δημιουργήστε προφίλ ή προσθέστε κράτηση για αυτόματη σύνδεση.
          </p>
          <Button onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Νέος πελάτης
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-14 text-center">
          <p className="mb-1 font-medium">Κανένα αποτέλεσμα</p>
          <p className="mb-4 text-sm text-muted-foreground">Δοκιμάστε άλλη αναζήτηση ή αφαιρέστε φίλτρα.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Καθαρισμός φίλτρων
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <ClientsTable rows={rows} sort={sort} onSort={onSort} onOpen={(id) => navigate(`/clients/${id}`)} />
          </div>
          <div className="md:hidden">
            <p className="mb-2 px-1 text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "πελάτης" : "πελάτες"} · ταξινόμηση: {SORT_LABELS[sort.key].toLowerCase()}
            </p>
            <ClientCardList rows={rows} onOpen={(id) => navigate(`/clients/${id}`)} />
          </div>
        </>
      )}

      <CreateClientDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
