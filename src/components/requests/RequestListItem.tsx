import { forwardRef } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import { AlertTriangle, Bike, Car, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { REQUEST_STATUS_LABELS } from "@/lib/status";
import type { BookingRequest } from "@/hooks/useBookingRequests";
import type { Vehicle } from "@/hooks/useVehicles";
import { STATUS_DOT, initials, nightsBetween, shortRange } from "./requestUtils";

interface RequestListItemProps {
  request: BookingRequest;
  vehicle: Vehicle | undefined;
  free: number | null;
  selected: boolean;
  onSelect: () => void;
}

export const RequestListItem = forwardRef<HTMLButtonElement, RequestListItemProps>(
  function RequestListItem({ request: r, vehicle, free, selected, onSelect }, ref) {
    const isNew = r.status === "new";
    const open = r.status === "new" || r.status === "reviewed";
    const nights = nightsBetween(r.check_in, r.check_out);
    const TypeIcon = vehicle?.type === "scooter" ? Bike : Car;
    const preview = r.message?.trim() || r.arrival_info?.trim() || r.pickup_location || "";

    return (
      <button
        ref={ref}
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "group relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected ? "bg-muted" : "hover:bg-muted/60",
        )}
      >
        {/* Avatar with vehicle-type badge (Airbnb guest + listing stack) */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold",
              isNew ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            {initials(r.customer_name)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-card text-muted-foreground shadow-sm">
            {vehicle?.image_url ? (
              <img src={vehicle.image_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <TypeIcon className="h-3 w-3" />
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                isNew ? "font-semibold text-foreground" : "font-medium text-foreground/90",
              )}
            >
              {r.customer_name}
            </p>
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                isNew ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {formatDistanceToNowStrict(parseISO(r.created_at), { locale: el, addSuffix: false })}
            </span>
          </div>

          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-foreground/80">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[r.status])} />
            <span className="shrink-0">{REQUEST_STATUS_LABELS[r.status] ?? r.status}</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate tabular-nums">
              {shortRange(r.check_in, r.check_out)}
              {nights > 0 ? ` · ${nights} ${nights === 1 ? "ημέρα" : "ημέρες"}` : ""}
            </span>
          </p>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {r.requested_vehicle || "Χωρίς όχημα"}
            {preview ? ` — ${preview}` : ""}
          </p>

          {(open && free != null) || r.estimated_total != null ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              {open && free != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    free === 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
                  )}
                >
                  {free === 0 ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {free === 0 ? "Μη διαθέσιμο" : `${free} διαθέσ.`}
                </span>
              )}
              {r.estimated_total != null && (
                <span className="ml-auto text-xs font-semibold tabular-nums text-foreground">
                  €{r.estimated_total}
                </span>
              )}
            </div>
          ) : null}
        </div>

        {isNew && (
          <span
            aria-label="Νέο"
            className="absolute left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent"
          />
        )}
      </button>
    );
  },
);
