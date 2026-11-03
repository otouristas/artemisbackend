import { Bike, Car, Check, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/hooks/useVehicles";
import type { VehicleAvailability } from "./utils";

export type VehicleTypeFilter = "all" | "car" | "scooter";

const TYPE_OPTIONS = [
  { key: "all" as const, label: "Όλα", icon: LayoutGrid },
  { key: "car" as const, label: "Αυτοκίνητα", icon: Car },
  { key: "scooter" as const, label: "Scooter", icon: Bike },
];

interface VehiclePickerProps {
  vehicles: Vehicle[];
  typeFilter: VehicleTypeFilter;
  onTypeFilterChange: (key: VehicleTypeFilter) => void;
  vehicleId: string;
  onVehicleChange: (id: string) => void;
  availability: Map<string, VehicleAvailability> | null;
}

export function VehicleThumb({ vehicle, className }: { vehicle?: Vehicle; className?: string }) {
  const Icon = vehicle?.type === "scooter" ? Bike : Car;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
        className,
      )}
    >
      {vehicle?.image_url ? (
        <img src={vehicle.image_url} alt={vehicle.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      )}
    </span>
  );
}

export function VehiclePicker({
  vehicles,
  typeFilter,
  onTypeFilterChange,
  vehicleId,
  onVehicleChange,
  availability,
}: VehiclePickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Τύπος οχήματος" className="inline-flex rounded-lg border bg-muted/60 p-0.5">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={typeFilter === t.key}
              onClick={() => onTypeFilterChange(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all coarse:py-2",
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
        <span className="hidden text-xs text-muted-foreground sm:inline">{vehicles.length} μοντέλα</span>
      </div>

      {vehicles.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Δεν υπάρχουν ενεργά οχήματα σε αυτή την κατηγορία.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label="Όχημα"
          className={cn(
            "grid grid-cols-1 gap-2 sm:grid-cols-2",
            vehicles.length > 6 && "max-h-[340px] overflow-y-auto overscroll-contain p-0.5 -m-0.5",
          )}
        >
          {vehicles.map((v) => {
            const selected = v.id === vehicleId;
            const a = availability?.get(v.id);
            const full = !!a && a.free === 0;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onVehicleChange(v.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl border bg-card p-2.5 text-left transition-all active:scale-[0.99]",
                  selected
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-foreground/25 hover:bg-muted/40",
                )}
              >
                <VehicleThumb vehicle={v} className="h-11 w-14" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{v.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {v.cc}cc · {v.type === "scooter" ? "Scooter" : "Αυτοκίνητο"}
                    {!a && v.quantity > 1 ? ` · ${v.quantity} μονάδες` : ""}
                  </span>
                </span>
                {a ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      full ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
                    )}
                  >
                    {full ? "Κλεισμένο" : `${a.free}/${a.quantity} ελεύθ.`}
                  </span>
                ) : null}
                {selected && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
