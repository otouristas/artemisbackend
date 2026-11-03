import type { ReactNode } from "react";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Bike, CalendarDays, Car, Loader2, MapPin, PenLine, Sparkles, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { STATUS_CHIP, STATUS_LABELS } from "@/lib/status";
import type { Vehicle } from "@/hooks/useVehicles";
import { formatEuro, initials, type AvailabilityTone, type BreakdownLike, type ExtraFee } from "./utils";

interface BookingSummaryCardProps {
  vehicle: Vehicle | undefined;
  assignedPlate: string;
  customerName: string;
  customerPhone: string;
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  daysCount: number;
  deliveryLocation: string;
  availability: AvailabilityTone;
  freeUnits: number;
  fleetQuantity: number;
  priceBreakdown: BreakdownLike | null;
  baseTotal: number;
  returningDiscount: number;
  extraFees: ExtraFee[];
  autoCalculatedTotal: number;
  totalPrice: number;
  isManualPrice: boolean;
  deposit: number;
  status: string;
  submitLabel: string;
  isSaving: boolean;
  onCancel: () => void;
  onDelete?: () => void;
}

function Row({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-[13px]", className)}>
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

const AVAILABILITY_PILL: Record<AvailabilityTone, { label: string; cls: string } | null> = {
  idle: null,
  free: { label: "Διαθέσιμο", cls: "text-success" },
  partial: { label: "Επικάλυψη", cls: "text-warning" },
  full: { label: "Κλεισμένο", cls: "text-destructive" },
};

/** Sticky right-hand trip summary: what is being rented, when, and what it costs. */
export function BookingSummaryCard({
  vehicle,
  assignedPlate,
  customerName,
  customerPhone,
  checkIn,
  checkOut,
  daysCount,
  deliveryLocation,
  availability,
  freeUnits,
  fleetQuantity,
  priceBreakdown,
  baseTotal,
  returningDiscount,
  extraFees,
  autoCalculatedTotal,
  totalPrice,
  isManualPrice,
  deposit,
  status,
  submitLabel,
  isSaving,
  onCancel,
  onDelete,
}: BookingSummaryCardProps) {
  const VehicleIcon = vehicle?.type === "scooter" ? Bike : Car;
  const pill = AVAILABILITY_PILL[availability];
  const balance = totalPrice - deposit;
  const showManualNote = isManualPrice && autoCalculatedTotal > 0 && autoCalculatedTotal !== totalPrice;

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      {/* Vehicle hero */}
      <div className="relative aspect-[16/8] bg-muted">
        {vehicle?.image_url ? (
          <img src={vehicle.image_url} alt={vehicle.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
            <VehicleIcon className="h-14 w-14" strokeWidth={1.25} />
          </div>
        )}
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur",
            STATUS_CHIP[status],
            "bg-card/95",
          )}
        >
          {STATUS_LABELS[status] || status}
        </span>
        {pill && (
          <span
            className={cn(
              "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border bg-card/95 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur",
              pill.cls,
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {pill.label} · {freeUnits}/{fleetQuantity}
          </span>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            {vehicle?.name ?? "Δεν έχει επιλεγεί όχημα"}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {vehicle ? (
              <>
                {vehicle.cc}cc · {vehicle.type === "scooter" ? "Scooter" : "Αυτοκίνητο"}
                {assignedPlate ? (
                  <span className="ml-1.5 rounded border bg-muted px-1.5 py-px font-mono text-[11px] font-semibold text-foreground">
                    {assignedPlate}
                  </span>
                ) : null}
              </>
            ) : (
              "Επιλέξτε μοντέλο από τον στόλο"
            )}
          </p>
        </div>

        <ul className="space-y-2.5 text-[13px]">
          <li className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            {checkIn || checkOut ? (
              <span className="min-w-0">
                <span className="block capitalize text-foreground">
                  {checkIn ? format(checkIn, "EEE d MMM yyyy", { locale: el }) : "—"}
                </span>
                <span className="block capitalize text-foreground">
                  {checkOut ? format(checkOut, "EEE d MMM yyyy", { locale: el }) : "—"}
                </span>
                {daysCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {daysCount} ημέρ{daysCount === 1 ? "α" : "ες"} ενοικίασης
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Χωρίς ημερομηνίες</span>
            )}
          </li>
          {deliveryLocation && (
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words text-foreground">{deliveryLocation}</span>
            </li>
          )}
          <li className="flex items-center gap-2.5">
            {customerName.trim() ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {initials(customerName)}
              </span>
            ) : (
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 truncate">
              <span className={customerName.trim() ? "text-foreground" : "text-muted-foreground"}>
                {customerName.trim() || "Χωρίς πελάτη"}
              </span>
              {customerPhone && <span className="ml-1.5 text-muted-foreground">{customerPhone}</span>}
            </span>
          </li>
        </ul>

        {/* Price breakdown */}
        <div className="border-t pt-4">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Ανάλυση τιμής{daysCount > 0 ? ` · ${daysCount} ημ.` : ""}
          </p>

          {priceBreakdown && !priceBreakdown.available ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3 text-xs font-medium leading-relaxed text-destructive">
              Οι τιμές για Scooters ισχύουν μόνο για τη μεσαία & peak σεζόν (11 Ιουν – 10 Σεπ). Εκτός αυτών των
              ημερομηνιών, επικοινωνήστε μαζί μας για διαθεσιμότητα.
            </div>
          ) : (
            <div className="space-y-1.5">
              {priceBreakdown?.segments.map((seg, idx) => (
                <Row
                  key={idx}
                  label={
                    <>
                      {seg.label}{" "}
                      <span className="text-muted-foreground/80">
                        · {seg.days} × {formatEuro(seg.rate)}
                      </span>
                    </>
                  }
                  value={formatEuro(seg.subtotal)}
                />
              ))}
              {!priceBreakdown && (
                <p className="text-[13px] text-muted-foreground">
                  Η τιμή υπολογίζεται μόλις επιλέξετε όχημα και ημερομηνίες.
                </p>
              )}
              {priceBreakdown && priceBreakdown.segments.length > 1 && (
                <Row label="Βασική τιμή" value={formatEuro(baseTotal)} className="pt-1" />
              )}
              {extraFees.map((f) => (
                <Row key={f.id} label={f.label} value={`+${formatEuro(f.amount)}`} />
              ))}
              {returningDiscount !== 0 && (
                <div className="flex items-baseline justify-between gap-3 text-[13px] font-medium text-success">
                  <span>Έκπτωση παλιού πελάτη</span>
                  <span className="tabular-nums">{formatEuro(returningDiscount)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="border-t pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Σύνολο</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                {isManualPrice ? (
                  <>
                    <PenLine className="h-3 w-3" /> Χειροκίνητη τιμή
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" /> Αυτόματος υπολογισμός
                  </>
                )}
              </p>
            </div>
            <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-foreground">
              {formatEuro(totalPrice)}
            </p>
          </div>
          {showManualNote && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Υπολογισμένη τιμή: <span className="font-medium text-foreground">{formatEuro(autoCalculatedTotal)}</span>
            </p>
          )}
          <div className="mt-3 space-y-1.5 rounded-lg bg-muted/60 px-3 py-2.5">
            <Row label="Προκαταβολή" value={formatEuro(deposit)} />
            <Row
              label={<span className="font-medium text-foreground">Υπόλοιπο προς είσπραξη</span>}
              value={
                <span className={cn("font-semibold", balance < 0 && "text-destructive")}>{formatEuro(balance)}</span>
              }
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <Button type="submit" size="lg" className="w-full text-[15px] font-semibold" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="w-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Ακύρωση
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Διαγραφή κράτησης
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
