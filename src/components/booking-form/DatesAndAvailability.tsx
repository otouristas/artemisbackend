import { format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { AlertTriangle, ArrowRight, CalendarDays, CircleCheck, CircleSlash, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_LABELS } from "@/lib/status";
import type { Booking } from "@/hooks/useBookings";
import { availabilityTone } from "./utils";

interface DateRangeFieldProps {
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  onCheckInChange: (d: Date | undefined) => void;
  onCheckOutChange: (d: Date | undefined) => void;
  daysCount: number;
}

function DateCell({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: Date | undefined;
  align?: "left" | "right";
}) {
  return (
    <span className={cn("flex min-w-0 flex-col", align === "right" && "sm:items-start")}>
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px] sm:tracking-[0.08em]">
        {label} *
      </span>
      {value ? (
        <>
          <span className="mt-0.5 truncate text-[15px] font-semibold capitalize text-foreground">
            {format(value, "EEE d MMM", { locale: el })}
          </span>
          <span className="text-xs text-muted-foreground">{format(value, "yyyy")}</span>
        </>
      ) : (
        <>
          <span className="mt-0.5 text-[15px] font-medium text-muted-foreground">Επιλογή</span>
          <span className="text-xs text-muted-foreground/70">ημερομηνίας</span>
        </>
      )}
    </span>
  );
}

/** Turo-style joined date pill: pickup | nights | return. Each half opens its own calendar. */
export function DateRangeField({ checkIn, checkOut, onCheckInChange, onCheckOutChange, daysCount }: DateRangeFieldProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch overflow-hidden rounded-xl border bg-card">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-4"
          >
            <CalendarDays className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
            <DateCell label="Παραλαβή" value={checkIn} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={checkIn}
            onSelect={onCheckInChange}
            locale={el}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <div className="flex flex-col items-center justify-center gap-1 border-x bg-muted/40 px-2.5 sm:px-4">
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span
          className={cn(
            "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
            daysCount > 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {daysCount > 0 ? `${daysCount} ημέρ${daysCount === 1 ? "α" : "ες"}` : "—"}
        </span>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-4"
          >
            <CalendarDays className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
            <DateCell label="Επιστροφή" value={checkOut} align="right" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={checkOut}
            onSelect={onCheckOutChange}
            locale={el}
            disabled={(date) => (checkIn ? date < checkIn : false)}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface AvailabilityStatusProps {
  hasVehicle: boolean;
  hasDates: boolean;
  vehicleName?: string;
  conflicts: Booking[];
  freeUnits: number;
  fleetQuantity: number;
}

/** Inline availability read-out for the chosen vehicle + dates. */
export function AvailabilityStatus({
  hasVehicle,
  hasDates,
  vehicleName,
  conflicts,
  freeUnits,
  fleetQuantity,
}: AvailabilityStatusProps) {
  const tone = availabilityTone(hasVehicle, hasDates, conflicts.length, freeUnits);

  if (tone === "idle") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-dashed px-3.5 py-3 text-[13px] text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Επιλέξτε όχημα και ημερομηνίες για να ελεγχθεί η διαθεσιμότητα.</span>
      </div>
    );
  }

  const config = {
    free: {
      icon: CircleCheck,
      box: "border-success/30 bg-success/[0.06]",
      text: "text-success",
      title: "Διαθέσιμο για αυτές τις ημερομηνίες",
    },
    partial: {
      icon: AlertTriangle,
      box: "border-warning/35 bg-warning/[0.07]",
      text: "text-warning",
      title: "Επικάλυψη με άλλες κρατήσεις",
    },
    full: {
      icon: CircleSlash,
      box: "border-destructive/30 bg-destructive/[0.06]",
      text: "text-destructive",
      title: "Πλήρως κλεισμένο",
    },
  }[tone];
  const Icon = config.icon;

  return (
    <div role="status" className={cn("rounded-lg border px-3.5 py-3", config.box)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.text)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className={cn("text-[13px] font-semibold", config.text)}>{config.title}</p>
            <p className="text-xs font-medium text-muted-foreground">
              {freeUnits}/{fleetQuantity} μονάδες ελεύθερες
            </p>
          </div>
          {conflicts.length > 0 && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Το <strong className="text-foreground">{vehicleName}</strong> έχει ήδη{" "}
                {conflicts.length === 1 ? "κράτηση" : `${conflicts.length} κρατήσεις`} για αυτό το διάστημα:
              </p>
              <ul className="mt-2 divide-y rounded-md border bg-card/70">
                {conflicts.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {b.customer_name}
                      {b.plate ? <span className="ml-1.5 font-normal text-muted-foreground">· {b.plate}</span> : null}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {format(parseISO(b.check_in), "d MMM", { locale: el })} →{" "}
                      {format(parseISO(b.check_out), "d MMM", { locale: el })} · {STATUS_LABELS[b.status] || b.status}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface PlatePickerProps {
  plates: string[];
  takenPlates: Set<string>;
  assignedPlate: string;
  onChange: (plate: string) => void;
  hasDates: boolean;
}

export function PlatePicker({ plates, takenPlates, assignedPlate, onChange, hasDates }: PlatePickerProps) {
  if (plates.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">Μονάδα / Πινακίδα</span>
        <span className="text-[11px] text-muted-foreground">
          {hasDates ? "Προαιρετικό" : "Επιλέξτε ημερομηνίες για διαθεσιμότητα"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {plates.map((p) => {
          const taken = takenPlates.has(p) && assignedPlate !== p;
          const active = assignedPlate === p;
          return (
            <button
              key={p}
              type="button"
              disabled={taken}
              onClick={() => onChange(active ? "" : p)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs font-semibold tracking-wide transition-all active:scale-[0.96] coarse:py-2",
                taken
                  ? "cursor-not-allowed border-destructive/30 bg-destructive/[0.06] text-destructive line-through opacity-80"
                  : active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-foreground/80 hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  taken ? "bg-destructive" : active ? "bg-primary-foreground" : "bg-success",
                )}
              />
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
