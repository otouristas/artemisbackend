import { format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { Bike, Car, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import type { BookingRequest } from "@/hooks/useBookingRequests";
import type { Vehicle } from "@/hooks/useVehicles";
import {
  VEHICLE_TYPE_TABS,
  freeUnitsForVehicle,
  initials,
  nightsBetween,
  type BookingLite,
  type VehicleTypeFilter,
} from "./requestUtils";

interface AcceptRequestDialogProps {
  target: BookingRequest | null;
  onClose: () => void;
  typeFilter: VehicleTypeFilter;
  onTypeFilterChange: (t: VehicleTypeFilter) => void;
  vehicleId: string;
  onVehicleIdChange: (id: string) => void;
  options: Vehicle[];
  bookings: BookingLite[];
  saving: boolean;
  onContinue: () => void;
}

export function AcceptRequestDialog({
  target,
  onClose,
  typeFilter,
  onTypeFilterChange,
  vehicleId,
  onVehicleIdChange,
  options,
  bookings,
  saving,
  onContinue,
}: AcceptRequestDialogProps) {
  const nights = target ? nightsBetween(target.check_in, target.check_out) : 0;

  return (
    <ResponsiveDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display">
            Αποδοχή · επιλογή οχήματος
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {target && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initials(target.customer_name)}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-semibold">{target.customer_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {format(parseISO(target.check_in), "d MMM yyyy", { locale: el })}
                  {" → "}
                  {format(parseISO(target.check_out), "d MMM yyyy", { locale: el })}
                  {nights > 0 ? ` · ${nights} ${nights === 1 ? "ημέρα" : "ημέρες"}` : ""}
                </p>
              </div>
            </div>
            {target.requested_vehicle && (
              <p className="text-xs text-muted-foreground">
                Αρχικό αίτημα:{" "}
                <span className="font-semibold text-foreground">{target.requested_vehicle}</span>
                {" — "}αν δεν υπάρχει διαθεσιμότητα, αλλάξτε τύπο ή μοντέλο παρακάτω.
              </p>
            )}

            <div className="inline-flex rounded-full bg-muted p-1">
              {VEHICLE_TYPE_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    onTypeFilterChange(t.key);
                    onVehicleIdChange("");
                  }}
                  className={cn(
                    "pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    typeFilter === t.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {options.length === 0 ? (
                <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
                  Δεν υπάρχουν οχήματα σε αυτή την κατηγορία.
                </p>
              ) : (
                options.map((v) => {
                  const free = freeUnitsForVehicle(v, target.check_in, target.check_out, bookings);
                  const selected = vehicleId === v.id;
                  const isRequested = target.requested_vehicle === v.name;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onVehicleIdChange(v.id)}
                      aria-pressed={selected}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50",
                        free === 0 && !selected && "opacity-60",
                      )}
                    >
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {v.image_url ? (
                          <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                        ) : v.type === "scooter" ? (
                          <Bike className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Car className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{v.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {v.type === "scooter" ? "Scooter" : "Αυτοκίνητο"} · {v.cc}cc
                          {isRequested ? " · ζητήθηκε" : ""}
                        </p>
                        <span
                          className={cn(
                            "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            free === 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-success/10 text-success",
                          )}
                        >
                          {free === 0 ? "Πλήρες" : `${free} διαθέσ.`}
                        </span>
                      </div>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
        <ResponsiveDialogFooter>
          <Button
            onClick={onContinue}
            disabled={!vehicleId || saving}
            className="gap-1.5 coarse:h-12 coarse:rounded-xl"
          >
            <Check className="h-4 w-4" />
            Συνέχεια στη κράτηση
          </Button>
          <Button variant="outline" onClick={onClose} className="coarse:h-12 coarse:rounded-xl">
            Ακύρωση
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
