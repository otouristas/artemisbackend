import { format, parseISO, differenceInDays } from "date-fns";
import { el } from "date-fns/locale";
import { Printer, X, CreditCard, MapPin, MessageSquare, User, Car, CalendarRange, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCallback } from "react";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface BookingPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  vehicle: Vehicle | undefined;
  onEdit: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  confirmed: "Επιβεβαιωμένη",
  cancelled: "Ακυρωμένη",
};

const STATUS_VARIANT: Record<string, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Μετρητά",
  bank: "Τραπεζική Κατάθεση",
  iris: "IRIS",
  card: "Κάρτα",
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground min-w-[110px]">{label}</span>
      <span className="text-sm font-medium text-right break-all">{value}</span>
    </div>
  );
}

export function BookingPreviewSheet({
  open,
  onOpenChange,
  booking,
  vehicle,
  onEdit,
}: BookingPreviewSheetProps) {
  const handlePrint = useCallback(() => {
    if (!booking) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const days = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
    const totalPrice = Number(booking.total_price) || 0;
    const deposit = Number(booking.deposit_amount) || 0;
    const remaining = totalPrice - deposit;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="el">
      <head>
        <meta charset="utf-8" />
        <title>Απόδειξη Κράτησης — ${booking.customer_name}</title>
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
          .row .label { color: #666; }
          .row .value { font-weight: 500; }
          .total-row { font-size: 15px; font-weight: 700; border-top: 2px solid #1a1a2e; padding-top: 8px; margin-top: 8px; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999; text-align: center; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area"><h1>Artemis Rental</h1><p>Σίφνος, Απολλωνία, Ενοικιάσεις Οχημάτων</p></div>
          <div class="receipt-id"><strong>Απόδειξη Κράτησης</strong>${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
        </div>
        <div class="section">
          <div class="section-title">Στοιχεία Πελάτη</div>
          <div class="row"><span class="label">Όνομα</span><span class="value">${booking.customer_name}</span></div>
          ${booking.customer_phone ? `<div class="row"><span class="label">Τηλέφωνο</span><span class="value">${booking.customer_phone}</span></div>` : ""}
          ${booking.customer_email ? `<div class="row"><span class="label">Email</span><span class="value">${booking.customer_email}</span></div>` : ""}
          ${(booking as any).id_document ? `<div class="row"><span class="label">Ταυτότητα</span><span class="value">${(booking as any).id_document}</span></div>` : ""}
        </div>
        <div class="section">
          <div class="section-title">Στοιχεία Κράτησης</div>
          <div class="row"><span class="label">Όχημα</span><span class="value">${vehicle?.name ?? "—"}</span></div>
          ${booking.plate ? `<div class="row"><span class="label">Πινακίδα</span><span class="value">${booking.plate}</span></div>` : ""}
          <div class="row"><span class="label">Check-in</span><span class="value">${format(parseISO(booking.check_in), "EEEE, d MMMM yyyy", { locale: el })}</span></div>
          <div class="row"><span class="label">Check-out</span><span class="value">${format(parseISO(booking.check_out), "EEEE, d MMMM yyyy", { locale: el })}</span></div>
          <div class="row"><span class="label">Διάρκεια</span><span class="value">${days} ημέρ${days === 1 ? "α" : "ες"}</span></div>
          ${(booking as any).delivery_location ? `<div class="row"><span class="label">Παράδοση</span><span class="value">${(booking as any).delivery_location}</span></div>` : ""}
        </div>
        <div class="section">
          <div class="section-title">Οικονομικά</div>
          <div class="row"><span class="label">Σύνολο</span><span class="value">${totalPrice}€</span></div>
          ${(booking as any).payment_method ? `<div class="row"><span class="label">Πληρωμή</span><span class="value">${PAYMENT_LABELS[(booking as any).payment_method] ?? (booking as any).payment_method}</span></div>` : ""}
          ${booking.payment_notes ? `<div class="row"><span class="label">Σημειώσεις</span><span class="value">${booking.payment_notes}</span></div>` : ""}
        </div>
        ${booking.comments ? `<div class="section"><div class="section-title">Σχόλια</div><p style="font-size:13px">${booking.comments}</p></div>` : ""}
        <div class="footer">Artemis Rental Σίφνος · rentacarsifnos.com</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }, [booking, vehicle]);

  if (!booking) return null;

  const days = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
  const totalPrice = Number(booking.total_price) || 0;

  let extraFees: { label: string; amount: number }[] = [];
  try {
    extraFees = (booking as any).extra_fees_json ? JSON.parse((booking as any).extra_fees_json) : [];
  } catch {}

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <SheetTitle className="text-lg font-display truncate">{booking.customer_name}</SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5", STATUS_VARIANT[booking.status])}>
                  {STATUS_LABELS[booking.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(booking.check_in), "dd MMM", { locale: el })} → {format(parseISO(booking.check_out), "dd MMM yyyy", { locale: el })} · {days} ημ.
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="px-5 py-4 space-y-5">
          {/* Customer */}
          <section className="space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Πελάτης</span>
            </div>
            <Row label="Όνομα" value={booking.customer_name} />
            <Row label="Τηλέφωνο" value={booking.customer_phone} />
            <Row label="Email" value={booking.customer_email} />
            <Row label="Ταυτότητα" value={(booking as any).id_document} />
          </section>

          {/* Booking */}
          <section className="space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Κράτηση</span>
            </div>
            <Row label="Όχημα" value={vehicle?.name} />
            <Row label="Πινακίδα" value={booking.plate ?? vehicle?.plate} />
            <Row label="Check-in" value={format(parseISO(booking.check_in), "EEEE, d MMMM yyyy", { locale: el })} />
            <Row label="Check-out" value={format(parseISO(booking.check_out), "EEEE, d MMMM yyyy", { locale: el })} />
            <Row label="Τοποθεσία παράδοσης" value={(booking as any).delivery_location} />
          </section>

          {/* Financials */}
          <section className="space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Οικονομικά</span>
            </div>
            <Row label="Σύνολο" value={totalPrice > 0 ? `${totalPrice}€` : undefined} />
            <Row
              label="Τρόπος πληρωμής"
              value={(booking as any).payment_method ? (PAYMENT_LABELS[(booking as any).payment_method] ?? (booking as any).payment_method) : undefined}
            />
            <Row label="Σημειώσεις πληρωμής" value={booking.payment_notes} />
            {extraFees.length > 0 && (
              <div className="pt-1 space-y-1">
                {extraFees.map((fee, i) => (
                  <Row
                    key={i}
                    label={fee.label}
                    value={fee.amount > 0 ? `+${fee.amount}€` : `${fee.amount}€`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Comments */}
          {booking.comments && (
            <section className="space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Σχόλια</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{booking.comments}</p>
            </section>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border/60">
            <Button className="flex-1" onClick={onEdit}>
              Επεξεργασία
            </Button>
            <Button variant="outline" size="icon" onClick={handlePrint} title="Εκτύπωση">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
