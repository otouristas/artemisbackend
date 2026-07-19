import { format, parseISO } from "date-fns";
import { el } from "date-fns/locale";

interface WhatsAppParams {
  customerName: string;
  customerPhone: string;
  vehicleName: string;
  checkIn: string;
  checkOut: string;
  deliveryLocation?: string;
  totalPrice?: number;
}

export function buildWhatsAppUrl({
  customerName,
  customerPhone,
  vehicleName,
  checkIn,
  checkOut,
  deliveryLocation,
  totalPrice,
}: WhatsAppParams): string {
  // Clean phone number
  let phone = customerPhone.replace(/\D/g, "");
  if (phone.startsWith("69")) phone = "30" + phone; // Greek mobile
  if (!phone.startsWith("30") && phone.length === 10) phone = "30" + phone;

  const checkInFormatted = format(parseISO(checkIn), "dd/MM/yyyy", { locale: el });
  const checkOutFormatted = format(parseISO(checkOut), "dd/MM/yyyy", { locale: el });

  let message = `Γεια σας ${customerName}!\n\nΕπιβεβαίωση κράτησης - Artemis Rental Σίφνος:\n\nΌχημα: ${vehicleName}\nCheck-in: ${checkInFormatted}\nCheck-out: ${checkOutFormatted}`;

  if (deliveryLocation) message += `\nΠαράδοση: ${deliveryLocation}`;
  if (totalPrice) message += `\nΣύνολο: ${totalPrice}€`;

  message += `\n\nΤηλ: +30 22840 33333 / WhatsApp: +30 698 590 8478\nΣας ευχαριστούμε!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
