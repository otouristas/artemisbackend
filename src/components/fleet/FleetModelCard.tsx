import { format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { Bike, CalendarClock, Car, ChevronRight, EyeOff, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { UNIT_STATUS, euro, modelState, type FleetUnit, type ModelSummary } from "./fleetData";

export function ModelPhoto({
  summary,
  className,
  iconClassName,
}: {
  summary: Pick<ModelSummary, "vehicle">;
  className?: string;
  iconClassName?: string;
}) {
  const v = summary.vehicle;
  const Icon = v.type === "car" ? Car : Bike;
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {v.image_url ? (
        <img src={v.image_url} alt={v.name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-secondary">
          <Icon className={cn("h-10 w-10 text-muted-foreground/50", iconClassName)} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

/** One dot per unit, coloured by today's status. */
export function UnitDots({ units, size = "md" }: { units: FleetUnit[]; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap items-center gap-1" aria-hidden>
      {units.map((u) => (
        <span
          key={u.index}
          className={cn(
            "rounded-full",
            size === "sm" ? "h-1.5 w-3" : "h-2 w-4",
            UNIT_STATUS[u.status].dot,
            u.status === "available" && "opacity-90",
          )}
        />
      ))}
    </div>
  );
}

export function PlateChip({ plate, muted }: { plate: string | null; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-1.5 font-mono text-[11px] font-semibold tracking-wide",
        plate ? "bg-background text-foreground/80" : "border-dashed text-muted-foreground",
        muted && "opacity-60",
      )}
    >
      {plate || "χωρίς πινακίδα"}
    </span>
  );
}

function PlateChips({ plates, total, max = 3 }: { plates: string[]; total: number; max?: number }) {
  const shown = plates.slice(0, max);
  const rest = Math.max(0, plates.length - max);
  const missing = Math.max(0, total - plates.length);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((p) => (
        <PlateChip key={p} plate={p} />
      ))}
      {rest > 0 && <span className="text-[11px] font-medium text-muted-foreground">+{rest}</span>}
      {plates.length === 0 && <PlateChip plate={null} />}
      {plates.length > 0 && missing > 0 && (
        <span className="text-[11px] text-warning">{missing} χωρίς πινακίδα</span>
      )}
    </div>
  );
}

function NextTrip({ summary }: { summary: ModelSummary }) {
  const b = summary.nextBooking;
  if (!b) return <span className="text-muted-foreground">Καμία επερχόμενη κράτηση</span>;
  return (
    <span className="truncate">
      <span className="text-muted-foreground">Επόμενη: </span>
      <span className="font-medium text-foreground">
        {format(parseISO(b.check_in), "d MMM", { locale: el })} – {format(parseISO(b.check_out), "d MMM", { locale: el })}
      </span>
      {summary.upcomingCount > 1 && <span className="text-muted-foreground"> · +{summary.upcomingCount - 1}</span>}
    </span>
  );
}

/** Photo-led model card (Turo "Vehicles" grid). */
export function FleetModelCard({ summary, onOpen }: { summary: ModelSummary; onOpen: () => void }) {
  const v = summary.vehicle;
  const state = modelState(summary);
  const pct = summary.total ? (summary.free / summary.total) * 100 : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group pressable flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !v.active && "opacity-70",
      )}
    >
      <div className="relative">
        <ModelPhoto summary={summary} className="aspect-[16/10] w-full" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-md",
              "bg-background/85",
              state.className,
            )}
          >
            {summary.activeBlock && <Wrench className="h-3 w-3" />}
            {state.label}
          </span>
          {!v.show_on_site && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-background/85 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-md">
              <EyeOff className="h-3 w-3" />
              Εκτός site
            </span>
          )}
        </div>
        <div className="absolute bottom-3 right-3 rounded-xl bg-background/90 px-2.5 py-1.5 text-right shadow-sm backdrop-blur-md">
          {summary.todayRate ? (
            <p className="text-base font-bold leading-none tabular-nums">
              {euro(summary.todayRate.daily_rate)}
              <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">/ημ.</span>
            </p>
          ) : (
            <p className="text-[11px] font-semibold text-destructive">Χωρίς τιμή σήμερα</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-semibold leading-tight tracking-tight">{v.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {v.type === "car" ? "Αυτοκίνητο" : "Scooter"} · {v.cc}cc · {summary.total}{" "}
              {summary.total === 1 ? "μονάδα" : "μονάδες"}
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              <span className="text-success">{summary.free}</span>
              <span className="text-muted-foreground"> / {summary.total} ελεύθερα σήμερα</span>
            </span>
            <UnitDots units={summary.units} size="sm" />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <PlateChips plates={summary.plates} total={summary.total} />

        <div className="mt-auto flex items-center gap-1.5 border-t pt-3 text-xs">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <NextTrip summary={summary} />
        </div>
      </div>
    </button>
  );
}

/** Dense row for the list view (Square item library). */
export function FleetModelRow({ summary, onOpen }: { summary: ModelSummary; onOpen: () => void }) {
  const v = summary.vehicle;
  const state = modelState(summary);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group grid w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-4",
        "grid-cols-[56px_1fr_auto] md:grid-cols-[64px_minmax(180px,1.4fr)_minmax(140px,1fr)_minmax(160px,1.2fr)_90px_minmax(140px,1fr)_132px_20px]",
        !v.active && "opacity-70",
      )}
    >
      <ModelPhoto summary={summary} className="h-12 w-14 rounded-lg md:h-12 md:w-16" iconClassName="h-5 w-5" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{v.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {v.type === "car" ? "Αυτοκίνητο" : "Scooter"} · {v.cc}cc
          <span className="md:hidden">
            {" · "}
            {summary.todayRate ? `${euro(summary.todayRate.daily_rate)}/ημ.` : "χωρίς τιμή"}
          </span>
        </p>
      </div>
      <div className="hidden md:block">
        <p className="mb-1 text-xs font-medium tabular-nums">
          <span className="text-success">{summary.free}</span>
          <span className="text-muted-foreground">/{summary.total} ελεύθερα</span>
        </p>
        <UnitDots units={summary.units} size="sm" />
      </div>
      <div className="hidden md:block">
        <PlateChips plates={summary.plates} total={summary.total} max={2} />
      </div>
      <div className="hidden text-right md:block">
        {summary.todayRate ? (
          <span className="text-sm font-semibold tabular-nums">{euro(summary.todayRate.daily_rate)}</span>
        ) : (
          <span className="text-xs font-medium text-destructive">–</span>
        )}
      </div>
      <div className="hidden min-w-0 text-xs md:block">
        <NextTrip summary={summary} />
      </div>
      <span
        className={cn(
          "justify-self-end whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold md:justify-self-start",
          state.className,
        )}
      >
        {state.label}
      </span>
      <ChevronRight className="hidden h-4 w-4 text-muted-foreground/50 md:block" />
    </button>
  );
}
