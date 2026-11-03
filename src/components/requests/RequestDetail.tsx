import type { ReactNode } from "react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Baby,
  Bike,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plane,
  Sparkles,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { REQUEST_STATUS_CHIP, REQUEST_STATUS_LABELS, SOURCE_LABELS } from "@/lib/status";
import type { BookingRequest } from "@/hooks/useBookingRequests";
import type { Vehicle } from "@/hooks/useVehicles";
import {
  initials,
  nightsBetween,
  requestWhatsAppUrl,
  type BookingLite,
} from "./requestUtils";

export type Alternative = { vehicle: Vehicle; free: number };

interface RequestDetailProps {
  request: BookingRequest;
  vehicle: Vehicle | undefined;
  free: number | null;
  conflicts: BookingLite[];
  alternatives: Alternative[];
  position: { index: number; total: number };
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onAccept: (vehicleId?: string) => void;
  onReject: () => void;
  onEdit: () => void;
  onMarkReviewed: () => void;
  onViewBooking: () => void;
  markingReviewed: boolean;
}

export function RequestDetail({
  request: r,
  vehicle,
  free,
  conflicts,
  alternatives,
  position,
  onPrev,
  onNext,
  onBack,
  onAccept,
  onReject,
  onEdit,
  onMarkReviewed,
  onViewBooking,
  markingReviewed,
}: RequestDetailProps) {
  const open = r.status === "new" || r.status === "reviewed";
  const nights = nightsBetween(r.check_in, r.check_out);
  const checkIn = parseISO(r.check_in);
  const checkOut = parseISO(r.check_out);
  const waUrl = requestWhatsAppUrl(r);
  const TypeIcon = vehicle?.type === "scooter" ? Bike : Car;
  const perDay =
    r.estimated_total != null && nights > 0 ? Math.round(r.estimated_total / nights) : null;

  return (
    <div className="flex min-h-full flex-col">
      {/* Pane toolbar (Linear issue header) */}
      <div className="z-20 flex h-14 lg:sticky lg:top-0 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full lg:hidden"
          onClick={onBack}
          aria-label="Πίσω στη λίστα"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="hidden text-muted-foreground sm:inline">Αιτήματα</span>
          <span className="hidden text-muted-foreground/60 sm:inline">/</span>
          <span className="truncate font-semibold">{r.customer_name}</span>
          <Badge
            variant="outline"
            className={cn("shrink-0 px-1.5 py-0 text-[10px]", REQUEST_STATUS_CHIP[r.status])}
          >
            {REQUEST_STATUS_LABELS[r.status] ?? r.status}
          </Badge>
        </div>
        <div className="hidden items-center gap-0.5 text-xs text-muted-foreground sm:flex">
          <span className="mr-1 tabular-nums">
            {position.index + 1} / {position.total}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrev}
            disabled={position.index <= 0}
            aria-label="Προηγούμενο αίτημα"
            title="Προηγούμενο (k)"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNext}
            disabled={position.index >= position.total - 1}
            aria-label="Επόμενο αίτημα"
            title="Επόμενο (j)"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Επεξεργασία</span>
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mx-auto grid w-full max-w-[1280px] gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr] xl:gap-x-8">
          {/* ── Main: hero + trip summary ───────────────── */}
          <div className="min-w-0 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Αίτημα κράτησης · {SOURCE_LABELS[r.source] ?? r.source}
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-[28px] sm:leading-tight">
                {r.requested_vehicle || "Όχημα χωρίς προτίμηση"}
                {nights > 0 && (
                  <span className="text-muted-foreground"> · {nights} {nights === 1 ? "ημέρα" : "ημέρες"}</span>
                )}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Λήφθηκε {format(parseISO(r.created_at), "EEEE d MMMM, HH:mm", { locale: el })} ·{" "}
                πριν {formatDistanceToNowStrict(parseISO(r.created_at), { locale: el })}
              </p>
            </div>

            {/* Trip summary card */}
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-4 p-4 sm:p-5">
                <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-36">
                  {vehicle?.image_url ? (
                    <img
                      src={vehicle.image_url}
                      alt={vehicle.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <TypeIcon className="h-8 w-8 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">
                    {vehicle?.name ?? r.requested_vehicle ?? "—"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {vehicle
                      ? `${vehicle.type === "scooter" ? "Scooter" : "Αυτοκίνητο"} · ${vehicle.cc}cc · ${vehicle.quantity ?? 1} ${(vehicle.quantity ?? 1) === 1 ? "μονάδα" : "μονάδες"}`
                      : r.requested_vehicle
                        ? "Δεν αντιστοιχεί σε όχημα του στόλου"
                        : "Ο πελάτης δεν επέλεξε όχημα"}
                  </p>
                  {vehicle && (
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      €{vehicle.daily_rate_low}–€{vehicle.daily_rate_high} / ημέρα
                    </p>
                  )}
                </div>
              </div>

              {/* Dates strip */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center border-t">
                <DateCell label="Παραλαβή" date={checkIn} />
                <div className="flex flex-col items-center px-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4" />
                  <span className="mt-0.5 whitespace-nowrap text-[11px] font-medium tabular-nums">
                    {nights} {nights === 1 ? "ημέρα" : "ημέρες"}
                  </span>
                </div>
                <DateCell label="Επιστροφή" date={checkOut} align="right" />
              </div>

              <dl className="divide-y border-t text-sm">
                <InfoRow icon={MapPin} label="Σημείο παραλαβής" value={r.pickup_location} />
                <InfoRow icon={MapPin} label="Σημείο επιστροφής" value={r.return_location} />
                <InfoRow
                  icon={Users}
                  label="Άτομα"
                  value={r.party_size != null ? String(r.party_size) : null}
                />
                <InfoRow icon={Baby} label="Παιδικό κάθισμα" value={r.child_seat ? "Ναι" : "Όχι"} />
                <InfoRow icon={Plane} label="Άφιξη / πτήσεις" value={r.arrival_info} />
              </dl>
            </section>
          </div>

          {/* ── Rail: guest, availability, estimate ─────── */}
          <aside className="min-w-0 space-y-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            {/* Guest card */}
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                  {initials(r.customer_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Πελάτης{r.locale ? ` · ${r.locale.toUpperCase()}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <ContactAction
                  href={r.customer_phone ? `tel:${r.customer_phone}` : undefined}
                  icon={Phone}
                  label="Κλήση"
                />
                <ContactAction
                  href={waUrl ?? undefined}
                  icon={MessageCircle}
                  label="WhatsApp"
                  external
                  highlight
                />
                <ContactAction
                  href={r.customer_email ? `mailto:${r.customer_email}` : undefined}
                  icon={Mail}
                  label="Email"
                />
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <dd className={cn("truncate", !r.customer_phone && "text-muted-foreground")}>
                    {r.customer_phone || "Χωρίς τηλέφωνο"}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <dd className={cn("truncate", !r.customer_email && "text-muted-foreground")}>
                    {r.customer_email || "Χωρίς email"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Availability check */}
            <AvailabilityCard
              request={r}
              vehicle={vehicle}
              free={free}
              conflicts={conflicts}
              alternatives={alternatives}
              onAccept={onAccept}
            />

            {/* Estimate */}
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <p className="text-sm font-semibold">Εκτίμηση τιμής</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Διάρκεια</span>
                  <span className="tabular-nums">
                    {nights} {nights === 1 ? "ημέρα" : "ημέρες"}
                  </span>
                </div>
                {perDay != null && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Μέση τιμή / ημέρα</span>
                    <span className="tabular-nums">≈ €{perDay}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2.5">
                  <span className="font-semibold">Σύνολο (εκτίμηση)</span>
                  <span className="text-lg font-bold tabular-nums">
                    {r.estimated_total != null ? `€${r.estimated_total}` : "—"}
                  </span>
                </div>
              </div>
            </section>
          </aside>

          {/* ── Main (cont.): message + notes ───────────── */}
          <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-2">
            <section>
              <p className="mb-2 text-sm font-semibold">Μήνυμα πελάτη</p>
              {r.message?.trim() ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initials(r.customer_name)}
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                    <p className="whitespace-pre-wrap break-words">{r.message}</p>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  Ο πελάτης δεν άφησε μήνυμα.
                </p>
              )}
            </section>

            {r.admin_notes?.trim() && (
              <section className="rounded-xl border bg-muted/40 p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Pencil className="h-3 w-3" />
                  Σημειώσεις γραφείου
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{r.admin_notes}</p>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Action bar (Deel/Airwallex approve-deny footer) */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mt-auto border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] items-center gap-2">
          {open ? (
            <>
              <p className="mr-auto hidden min-w-0 truncate text-sm text-muted-foreground md:block">
                {free === 0
                  ? "Το όχημα δεν είναι διαθέσιμο — αποδεχτείτε με άλλο όχημα."
                  : "Ελέγξτε τα στοιχεία και αποδεχτείτε για να δημιουργηθεί κράτηση."}
              </p>
              {r.status === "new" && (
                <Button
                  variant="ghost"
                  className="hidden h-10 gap-1.5 sm:inline-flex"
                  onClick={onMarkReviewed}
                  disabled={markingReviewed}
                >
                  <Eye className="h-4 w-4" />
                  Σήμανση ως ελεγμένο
                </Button>
              )}
              <Button
                variant="outline"
                className="h-12 flex-1 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive md:h-10 md:flex-none"
                onClick={onReject}
              >
                <X className="h-4 w-4" />
                Απόρριψη
              </Button>
              <Button
                className="h-12 flex-[2] gap-1.5 md:h-10 md:flex-none md:px-6"
                onClick={() => onAccept()}
              >
                <Check className="h-4 w-4" />
                Αποδοχή
              </Button>
            </>
          ) : r.status === "accepted" ? (
            <>
              <p className="mr-auto flex min-w-0 items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Έγινε αποδοχή</span>
              </p>
              {r.booking_id && (
                <Button className="h-12 gap-1.5 md:h-10" onClick={onViewBooking}>
                  Προβολή κράτησης
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="mr-auto flex min-w-0 items-center gap-1.5 text-sm text-destructive">
                <X className="h-4 w-4 shrink-0" />
                <span className="truncate">Το αίτημα απορρίφθηκε</span>
              </p>
              <Button variant="outline" className="h-12 gap-1.5 md:h-10" onClick={onEdit}>
                <Undo2 className="h-4 w-4" />
                Αλλαγή κατάστασης
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DateCell({ label, date, align }: { label: string; date: Date; align?: "right" }) {
  return (
    <div className={cn("px-4 py-3.5 sm:px-5", align === "right" && "text-right")}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold capitalize tabular-nums sm:text-lg">
        {format(date, "EEE d MMM", { locale: el })}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{format(date, "yyyy")}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 flex-1 break-words text-right sm:text-left", !value && "text-muted-foreground/70")}>
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}

function ContactAction({
  href,
  icon: Icon,
  label,
  external,
  highlight,
}: {
  href?: string;
  icon: typeof Phone;
  label: string;
  external?: boolean;
  highlight?: boolean;
}): ReactNode {
  const base =
    "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors";
  if (!href) {
    return (
      <span className={cn(base, "cursor-not-allowed text-muted-foreground/50")} aria-disabled>
        <Icon className="h-4 w-4" />
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        base,
        "pressable",
        highlight
          ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
          : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </a>
  );
}

function AvailabilityCard({
  request: r,
  vehicle,
  free,
  conflicts,
  alternatives,
  onAccept,
}: {
  request: BookingRequest;
  vehicle: Vehicle | undefined;
  free: number | null;
  conflicts: BookingLite[];
  alternatives: Alternative[];
  onAccept: (vehicleId?: string) => void;
}) {
  const open = r.status === "new" || r.status === "reviewed";
  const total = vehicle?.quantity ?? 1;

  let tone: "ok" | "bad" | "unknown" = "unknown";
  if (vehicle && free != null) tone = free > 0 ? "ok" : "bad";

  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4 sm:p-5",
        tone === "bad" && "border-destructive/30",
        tone === "ok" && "border-success/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            tone === "ok" && "bg-success/10 text-success",
            tone === "bad" && "bg-destructive/10 text-destructive",
            tone === "unknown" && "bg-warning/10 text-warning",
          )}
        >
          {tone === "ok" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {tone === "ok"
              ? "Διαθέσιμο για αυτές τις ημερομηνίες"
              : tone === "bad"
                ? "Μη διαθέσιμο"
                : "Χωρίς έλεγχο διαθεσιμότητας"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {vehicle && free != null
              ? `${free} από ${total} ${total === 1 ? "μονάδα ελεύθερη" : "μονάδες ελεύθερες"} · ${vehicle.name}`
              : "Το ζητούμενο όχημα δεν αντιστοιχεί στον στόλο. Επιλέξτε όχημα κατά την αποδοχή."}
          </p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Επικαλυπτόμενες κρατήσεις
          </p>
          {conflicts.slice(0, 4).map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs"
            >
              <span className="truncate font-medium">{b.customer_name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {format(parseISO(b.check_in), "d MMM", { locale: el })} –{" "}
                {format(parseISO(b.check_out), "d MMM", { locale: el })}
              </span>
            </div>
          ))}
          {conflicts.length > 4 && (
            <p className="text-xs text-muted-foreground">+{conflicts.length - 4} ακόμη</p>
          )}
        </div>
      )}

      {open && tone !== "ok" && alternatives.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Διαθέσιμες εναλλακτικές
          </p>
          {alternatives.map(({ vehicle: v, free: f }) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onAccept(v.id)}
              className="pressable flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {v.image_url ? (
                  <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                ) : v.type === "scooter" ? (
                  <Bike className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Car className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{v.name}</span>
              <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                {f} διαθέσ.
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
