import { format, parseISO, differenceInDays } from "date-fns";
import { el } from "date-fns/locale";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";

interface BookingReceiptProps {
  booking: Booking;
  vehicle: Vehicle | undefined;
  className?: string;
  /** Show the text label on all breakpoints (default: icon-only on phones). */
  showLabel?: boolean;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Μετρητά",
  bank: "Τραπεζική κατάθεση",
  iris: "IRIS",
  card: "Κάρτα",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function eur(n: number): string {
  return `${(Number.isFinite(n) ? n : 0).toLocaleString("el-GR", { maximumFractionDigits: 2 })}€`;
}

interface FeeLine {
  id?: string;
  label?: string;
  amount?: number;
}

function parseFees(json: string | null): FeeLine[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as FeeLine[]) : [];
  } catch {
    return [];
  }
}

export function BookingReceipt({ booking, vehicle, className, showLabel }: BookingReceiptProps) {
  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const days = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
    const totalPrice = Number(booking.total_price) || 0;
    const deposit = Number(booking.deposit_amount) || 0;
    const remaining = totalPrice - deposit;
    const fees = parseFees(booking.extra_fees_json);
    const feesSum = fees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const rental = totalPrice - feesSum;
    const receiptNo = booking.id.slice(0, 8).toUpperCase();
    const vehicleLabel = vehicle ? `${vehicle.name} (${vehicle.cc}cc)` : "—";

    const lines = [
      {
        label: `Ενοικίαση ${vehicleLabel}`,
        sub: `${format(parseISO(booking.check_in), "d MMM", { locale: el })} → ${format(parseISO(booking.check_out), "d MMM yyyy", { locale: el })}${booking.plate ? ` · ${booking.plate}` : ""}`,
        qty: `${days} ημ.`,
        amount: rental,
      },
      ...fees.map((f) => ({ label: f.label ?? "Χρέωση", sub: "", qty: "", amount: Number(f.amount) || 0 })),
    ];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="el">
      <head>
        <meta charset="utf-8" />
        <title>Απόδειξη Κράτησης — ${esc(booking.customer_name)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #0b2a3c;
            background: #fff;
            font-size: 13px;
            line-height: 1.45;
          }
          .sheet { max-width: 680px; margin: 0 auto; padding: 40px 40px 32px; border-top: 4px solid #0b2a3c; }
          .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
          .brand { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
          .brand small { display: block; font-size: 11px; font-weight: 400; color: #5b6b78; margin-top: 2px; }
          h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin: 28px 0 10px; }
          .meta { display: grid; grid-template-columns: auto 1fr; column-gap: 16px; row-gap: 2px; font-size: 12px; }
          .meta dt { color: #5b6b78; }
          .meta dd { font-weight: 600; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
          .parties h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5b6b78; margin-bottom: 6px; font-weight: 600; }
          .parties p { font-size: 13px; }
          .parties .strong { font-weight: 600; }
          .due { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 22px; }
          .due span { color: #5b6b78; font-weight: 500; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #5b6b78; font-weight: 600; padding: 0 0 8px; border-bottom: 1px solid #0b2a3c; }
          th.r, td.r { text-align: right; }
          td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          td .sub { display: block; color: #5b6b78; font-size: 12px; margin-top: 1px; }
          .totals { margin-left: auto; width: 60%; margin-top: 14px; }
          .totals .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
          .totals .row span:first-child { color: #5b6b78; }
          .totals .row.total { border-bottom: none; font-weight: 700; font-size: 15px; padding-top: 10px; }
          .totals .row.total span:first-child { color: #0b2a3c; }
          .totals .row.balance span:last-child { color: #b42318; font-weight: 700; }
          .notes { margin-top: 28px; padding: 14px 16px; background: #f4f5f7; border-radius: 8px; font-size: 12px; white-space: pre-wrap; }
          .notes h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5b6b78; margin-bottom: 4px; }
          .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #5b6b78; display: flex; justify-content: space-between; gap: 16px; }
          @media print { .sheet { padding: 16px 8px; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="top">
            <div class="brand">Artemis Rental<small>Σίφνος, Απολλωνία · Ενοικιάσεις Οχημάτων</small></div>
            <div style="text-align:right;font-size:11px;color:#5b6b78">${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
          </div>

          <h1>Απόδειξη κράτησης</h1>
          <dl class="meta">
            <dt>Αριθμός</dt><dd>#${esc(receiptNo)}</dd>
            <dt>Ημ. έκδοσης</dt><dd>${format(new Date(), "d MMMM yyyy", { locale: el })}</dd>
            ${booking.payment_method ? `<dt>Πληρωμή</dt><dd>${esc(PAYMENT_LABELS[booking.payment_method] ?? booking.payment_method)}</dd>` : ""}
          </dl>

          <div class="parties">
            <div>
              <h3>Από</h3>
              <p class="strong">Artemis Rental</p>
              <p>Απολλωνία, Σίφνος</p>
              <p>info@artemisrental.gr</p>
            </div>
            <div>
              <h3>Πελάτης</h3>
              <p class="strong">${esc(booking.customer_name)}</p>
              ${booking.customer_phone ? `<p>${esc(booking.customer_phone)}</p>` : ""}
              ${booking.customer_email ? `<p>${esc(booking.customer_email)}</p>` : ""}
              ${booking.id_document ? `<p>Ταυτότητα: ${esc(booking.id_document)}</p>` : ""}
            </div>
          </div>

          <div class="parties" style="margin-top:-8px">
            <div>
              <h3>Παραλαβή</h3>
              <p class="strong">${esc(format(parseISO(booking.check_in), "EEEE, d MMMM yyyy", { locale: el }))}</p>
              ${booking.delivery_location ? `<p>${esc(booking.delivery_location)}</p>` : ""}
            </div>
            <div>
              <h3>Επιστροφή</h3>
              <p class="strong">${esc(format(parseISO(booking.check_out), "EEEE, d MMMM yyyy", { locale: el }))}</p>
              <p>${days} ημέρ${days === 1 ? "α" : "ες"}</p>
            </div>
          </div>

          <p class="due">${eur(remaining)} <span>υπόλοιπο προς εξόφληση</span></p>

          <table>
            <thead><tr><th>Περιγραφή</th><th class="r">Ποσ.</th><th class="r">Ποσό</th></tr></thead>
            <tbody>
              ${lines
                .map(
                  (l) =>
                    `<tr><td>${esc(l.label)}${l.sub ? `<span class="sub">${esc(l.sub)}</span>` : ""}</td><td class="r">${esc(l.qty)}</td><td class="r">${eur(l.amount)}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>

          <div class="totals">
            <div class="row total"><span>Συνολικό ποσό</span><span>${eur(totalPrice)}</span></div>
            <div class="row"><span>Προκαταβολή</span><span>${eur(deposit)}</span></div>
            <div class="row balance"><span>Υπόλοιπο</span><span>${eur(remaining)}</span></div>
          </div>

          ${booking.comments ? `<div class="notes"><h3>Σημειώσεις</h3>${esc(booking.comments)}</div>` : ""}

          <div class="footer">
            <span>Artemis Rental Σίφνος · info@artemisrental.gr · +30 22840 33333</span>
            <span>#${esc(receiptNo)}</span>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }, [booking, vehicle]);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrint}
      className={cn("gap-1.5 hover:bg-muted hover:text-foreground", className)}
      title="Εκτύπωση απόδειξης"
    >
      <Printer className="h-4 w-4" />
      <span className={showLabel ? "" : "hidden sm:inline"}>Απόδειξη</span>
    </Button>
  );
}
