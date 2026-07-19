import { format, parseISO, differenceInDays } from "date-fns";
import { el } from "date-fns/locale";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useRef } from "react";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";

interface BookingReceiptProps {
  booking: Booking;
  vehicle: Vehicle | undefined;
}

export function BookingReceipt({ booking, vehicle }: BookingReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !receiptRef.current) return;

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
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; 
            padding: 32px; 
            color: #1a1a2e; 
            max-width: 600px; 
            margin: 0 auto;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            border-bottom: 2px solid #0b2a3c; 
            padding-bottom: 16px; 
            margin-bottom: 24px; 
          }
          .logo-area h1 { font-size: 20px; font-weight: 700; color: #0b2a3c; }
          .logo-area p { font-size: 11px; color: #666; margin-top: 2px; }
          .receipt-id { font-size: 11px; color: #666; text-align: right; }
          .receipt-id strong { display: block; font-size: 13px; color: #333; }
          .section { margin-bottom: 20px; }
          .section-title { 
            font-size: 11px; 
            font-weight: 600; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
            color: #0b2a3c; 
            margin-bottom: 8px; 
            border-bottom: 1px solid #e5e7eb; 
            padding-bottom: 4px; 
          }
          .row { 
            display: flex; 
            justify-content: space-between; 
            padding: 4px 0; 
            font-size: 13px; 
          }
          .row .label { color: #666; }
          .row .value { font-weight: 500; }
          .total-row { 
            font-size: 15px; 
            font-weight: 700; 
            border-top: 2px solid #1a1a2e; 
            padding-top: 8px; 
            margin-top: 8px; 
          }
          .remaining { color: #dc2626; }
          .footer { 
            margin-top: 32px; 
            padding-top: 16px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 11px; 
            color: #999; 
            text-align: center; 
          }
          @media print {
            body { padding: 16px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <h1>Artemis Rental</h1>
            <p>Σίφνος, Απολλωνία, Ενοικιάσεις Οχημάτων</p>
          </div>
          <div class="receipt-id">
            <strong>Απόδειξη Κράτησης</strong>
            ${format(new Date(), "dd/MM/yyyy HH:mm")}
          </div>
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
          <div class="row"><span class="label">Όχημα</span><span class="value">${vehicle?.name ?? "—"} (${vehicle?.cc ?? ""}cc)</span></div>
          <div class="row"><span class="label">Check-in</span><span class="value">${format(parseISO(booking.check_in), "EEEE, d MMMM yyyy", { locale: el })}</span></div>
          <div class="row"><span class="label">Check-out</span><span class="value">${format(parseISO(booking.check_out), "EEEE, d MMMM yyyy", { locale: el })}</span></div>
          <div class="row"><span class="label">Διάρκεια</span><span class="value">${days} ημέρ${days === 1 ? "α" : "ες"}</span></div>
          ${(booking as any).delivery_location ? `<div class="row"><span class="label">Παράδοση</span><span class="value">${(booking as any).delivery_location}</span></div>` : ""}
        </div>

        <div class="section">
          <div class="section-title">Οικονομικά Στοιχεία</div>
          <div class="row"><span class="label">Συνολικό ποσό</span><span class="value">${totalPrice}€</span></div>
          <div class="row"><span class="label">Προκαταβολή</span><span class="value">${deposit}€</span></div>
          <div class="row total-row"><span class="label">Υπόλοιπο</span><span class="value remaining">${remaining}€</span></div>
        </div>

        ${booking.comments ? `<div class="section"><div class="section-title">Σημειώσεις</div><p style="font-size:13px">${booking.comments}</p></div>` : ""}

        <div class="footer">
          Artemis Rental Σίφνος · info@artemisrental.gr · +30 22840 33333
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }, [booking, vehicle]);

  return (
    <Button type="button" variant="outline" onClick={handlePrint} className="gap-1.5" title="Εκτύπωση απόδειξης">
      <Printer className="h-4 w-4" />
      <span className="hidden sm:inline">Εκτύπωση</span>
    </Button>
  );
}
