import { useCallback } from "react";
import { format, parseISO, isWithinInterval, startOfDay } from "date-fns";
import { el } from "date-fns/locale";
import {
  ArrowRight,
  Bike,
  CalendarClock,
  Car,
  Check,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  PAYMENT_LABELS,
  SOURCE_LABELS,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_PILL,
  finance,
  initials,
  money,
  rentalDays,
  type BookingStatus,
} from "@/components/bookings/bookingUtils";

interface BookingPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  vehicle: Vehicle | undefined;
  onEdit: () => void;
  onStatusChange?: (status: BookingStatus) => void;
  onDelete?: () => void;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function parseFees(json: string | null): { label: string; amount: number }[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function BookingPreviewSheet({
  open,
  onOpenChange,
  booking,
  vehicle,
  onEdit,
  onStatusChange,
  onDelete,
}: BookingPreviewSheetProps) {
  const handlePrint = useCallback(() => {
    if (!booking) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const days = rentalDays(booking);
    const f = finance(booking);
    const row = (label: string, value: unknown) =>
      value || value === 0 ? `<div class="row"><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span></div>` : "";
    w.document.write(`<!DOCTYPE html><html lang="el"><head><meta charset="utf-8" />
      <title>Απόδειξη Κράτησης — ${esc(booking.customer_name)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; padding: 32px; color: #1a1a2e; max-width: 600px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0b2a3c; padding-bottom: 16px; margin-bottom: 24px; }
        .logo-area h1 { font-size: 20px; font-weight: 700; color: #0b2a3c; }
        .logo-area p { font-size: 11px; color: #666; margin-top: 2px; }
        .receipt-id { font-size: 11px; color: #666; text-align: right; }
        .receipt-id strong { display: block; font-size: 13px; color: #333; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #0b2a3c; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .row .label { color: #666; } .row .value { font-weight: 500; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999; text-align: center; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <div class="header">
        <div class="logo-area"><h1>Artemis Rental</h1><p>Σίφνος, Απολλωνία, Ενοικιάσεις Οχημάτων</p></div>
        <div class="receipt-id"><strong>Απόδειξη Κράτησης</strong>${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      </div>
      <div class="section"><div class="section-title">Στοιχεία Πελάτη</div>
        ${row("Όνομα", booking.customer_name)}${row("Τηλέφωνο", booking.customer_phone)}${row("Email", booking.customer_email)}${row("Ταυτότητα", booking.id_document)}
      </div>
      <div class="section"><div class="section-title">Στοιχεία Κράτησης</div>
        ${row("Όχημα", vehicle?.name ?? "—")}${row("Πινακίδα", booking.plate)}
        ${row("Check-in", format(parseISO(booking.check_in), "EEEE, d MMMM yyyy", { locale: el }))}
        ${row("Check-out", format(parseISO(booking.check_out), "EEEE, d MMMM yyyy", { locale: el }))}
        ${row("Διάρκεια", `${days} ημέρ${days === 1 ? "α" : "ες"}`)}${row("Παράδοση", booking.delivery_location)}
      </div>
      <div class="section"><div class="section-title">Οικονομικά</div>
        ${row("Σύνολο", `${f.total}€`)}${f.deposit ? row("Προκαταβολή", `${f.deposit}€`) : ""}${f.remaining ? row("Υπόλοιπο", `${f.remaining}€`) : ""}
        ${row("Πληρωμή", booking.payment_method ? PAYMENT_LABELS[booking.payment_method] ?? booking.payment_method : "")}${row("Σημειώσεις", booking.payment_notes)}
      </div>
      ${booking.comments ? `<div class="section"><div class="section-title">Σχόλια</div><p style="font-size:13px">${esc(booking.comments)}</p></div>` : ""}
      <div class="footer">Artemis Rental Σίφνος · rentacarsifnos.com</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }, [booking, vehicle]);

  if (!booking) return null;

  const days = rentalDays(booking);
  const f = finance(booking);
  const fees = parseFees(booking.extra_fees_json);
  const paidPct = f.total > 0 ? Math.min(100, Math.round((f.deposit / f.total) * 100)) : 0;
  const today = startOfDay(new Date());
  const inStay =
    booking.status !== "cancelled" &&
    isWithinInterval(today, { start: parseISO(booking.check_in), end: parseISO(booking.check_out) });
  const VehicleIcon = vehicle?.type === "scooter" ? Bike : Car;

  const whatsapp = () => {
    if (!booking.customer_phone) return;
    window.open(
      buildWhatsAppUrl({
        customerName: booking.customer_name,
        customerPhone: booking.customer_phone,
        vehicleName: vehicle?.name ?? "",
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        deliveryLocation: booking.delivery_location || undefined,
        totalPrice: booking.total_price || undefined,
      }),
      "_blank",
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]">
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="space-y-4 border-b px-5 pb-5 pt-6 text-left">
            <div className="flex items-center gap-2 pr-8">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  STATUS_PILL[booking.status],
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[booking.status])} />
                {STATUS_LABEL[booking.status]}
              </span>
              {inStay && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  Σε ενοικίαση
                </span>
              )}
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">#{booking.id.slice(0, 6).toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                {initials(booking.customer_name)}
              </span>
              <div className="min-w-0">
                <SheetTitle className="truncate text-xl font-semibold tracking-tight">{booking.customer_name}</SheetTitle>
                <SheetDescription className="truncate text-sm">
                  {booking.customer_phone || booking.customer_email || "Χωρίς στοιχεία επικοινωνίας"}
                </SheetDescription>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <QuickAction icon={Phone} label="Κλήση" href={booking.customer_phone ? `tel:${booking.customer_phone}` : undefined} />
              <QuickAction icon={MessageCircle} label="WhatsApp" onClick={booking.customer_phone ? whatsapp : undefined} />
              <QuickAction icon={Mail} label="Email" href={booking.customer_email ? `mailto:${booking.customer_email}` : undefined} />
            </div>
          </SheetHeader>

          <div className="space-y-4 px-5 py-5">
            {/* Trip */}
            <section className="rounded-xl border bg-card">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Παραλαβή</div>
                  <div className="mt-1 text-[15px] font-semibold capitalize">
                    {format(parseISO(booking.check_in), "EEE d MMM", { locale: el })}
                  </div>
                  <div className="text-xs text-muted-foreground">{format(parseISO(booking.check_in), "yyyy")}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Επιστροφή</div>
                  <div className="mt-1 text-[15px] font-semibold capitalize">
                    {format(parseISO(booking.check_out), "EEE d MMM", { locale: el })}
                  </div>
                  <div className="text-xs text-muted-foreground">{format(parseISO(booking.check_out), "yyyy")}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  {days} {days === 1 ? "ημέρα" : "ημέρες"}
                </span>
                {booking.delivery_location && (
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{booking.delivery_location}</span>
                  </span>
                )}
              </div>
            </section>

            {/* Vehicle */}
            <section className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                {vehicle?.image_url ? (
                  <img src={vehicle.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <VehicleIcon className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{vehicle?.name ?? "Άγνωστο όχημα"}</div>
                <div className="text-xs text-muted-foreground">
                  {vehicle?.type === "scooter" ? "Scooter" : "Αυτοκίνητο"}
                  {vehicle?.cc ? ` · ${vehicle.cc}cc` : ""}
                </div>
              </div>
              {booking.plate ? (
                <span className="shrink-0 rounded-md border bg-background px-2 py-1 font-mono text-xs font-semibold tracking-wide">
                  {booking.plate}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">Χωρίς πινακίδα</span>
              )}
            </section>

            {/* Payment */}
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Πληρωμή</span>
                {f.total > 0 &&
                  (f.remaining > 0 ? (
                    <span className="text-xs font-semibold text-warning">Υπόλοιπο {money(f.remaining)}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <Check className="h-3.5 w-3.5" /> Εξοφλημένη
                    </span>
                  ))}
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                {f.total > 0 ? money(f.total) : "—"}
              </div>
              {f.total > 0 && (
                <>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", f.remaining > 0 ? "bg-warning" : "bg-success")}
                      style={{ width: `${f.remaining > 0 ? paidPct : 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Προκαταβολή {money(f.deposit)}</span>
                    <span>{money(f.total / days)}/ημέρα</span>
                  </div>
                </>
              )}
              <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm empty:hidden">
                {booking.payment_method && (
                  <InfoRow label="Τρόπος" value={PAYMENT_LABELS[booking.payment_method] ?? booking.payment_method} />
                )}
                {fees.map((fee, i) => (
                  <InfoRow key={i} label={fee.label} value={`${fee.amount > 0 ? "+" : ""}${fee.amount}€`} />
                ))}
                {booking.payment_notes && <InfoRow label="Σημειώσεις" value={booking.payment_notes} />}
              </dl>
            </section>

            {/* Notes */}
            {booking.comments && (
              <section className="rounded-xl border bg-muted/40 p-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Σχόλια
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{booking.comments}</p>
              </section>
            )}

            <dl className="space-y-1.5 px-1 text-sm">
              {booking.id_document && <InfoRow label="Ταυτότητα" value={booking.id_document} />}
              {booking.customer_email && <InfoRow label="Email" value={booking.customer_email} />}
              {booking.booking_source && (
                <InfoRow label="Πηγή" value={SOURCE_LABELS[booking.booking_source] ?? booking.booking_source} />
              )}
              <InfoRow label="Δημιουργήθηκε" value={format(parseISO(booking.created_at), "d MMM yyyy, HH:mm", { locale: el })} />
            </dl>
          </div>
        </div>

        {/* Sticky actions */}
        <div className="flex items-center gap-2 border-t bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {booking.status === "pending" && onStatusChange ? (
            <>
              <Button className="flex-1 gap-1.5" onClick={() => onStatusChange("confirmed")}>
                <Check className="h-4 w-4" /> Επιβεβαίωση
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Επεξεργασία
              </Button>
            </>
          ) : (
            <Button className="flex-1 gap-1.5" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Επεξεργασία
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handlePrint} title="Εκτύπωση" aria-label="Εκτύπωση">
            <Printer className="h-4 w-4" />
          </Button>
          {(onStatusChange || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Περισσότερα">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {onStatusChange && booking.status !== "confirmed" && (
                  <DropdownMenuItem onClick={() => onStatusChange("confirmed")}>
                    <Check className="mr-2 h-4 w-4" /> Επιβεβαίωση
                  </DropdownMenuItem>
                )}
                {onStatusChange && booking.status !== "pending" && (
                  <DropdownMenuItem onClick={() => onStatusChange("pending")}>
                    <CalendarClock className="mr-2 h-4 w-4" /> Σε εκκρεμότητα
                  </DropdownMenuItem>
                )}
                {onStatusChange && booking.status !== "cancelled" && (
                  <DropdownMenuItem onClick={() => onStatusChange("cancelled")}>
                    <XCircle className="mr-2 h-4 w-4" /> Ακύρωση κράτησης
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Διαγραφή
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const disabled = !href && !onClick;
  const cls = cn(
    "flex flex-col items-center justify-center gap-1 rounded-xl border bg-card py-2.5 text-xs font-medium transition-colors",
    disabled ? "pointer-events-none opacity-40" : "hover:bg-muted active:scale-[0.98]",
  );
  if (href)
    return (
      <a href={href} className={cls}>
        <Icon className="h-4 w-4" />
        {label}
      </a>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
