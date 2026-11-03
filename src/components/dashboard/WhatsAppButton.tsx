import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";

/** Round WhatsApp shortcut; stops propagation so it can sit inside clickable rows. */
export function WhatsAppButton({
  booking,
  vehicleName,
  className,
}: {
  booking: Booking;
  vehicleName: string;
  className?: string;
}) {
  if (!booking.customer_phone) return null;
  return (
    <Button
      size="icon"
      variant="outline"
      className={cn("h-10 w-10 shrink-0 rounded-full text-success hover:text-success coarse:h-11 coarse:w-11", className)}
      aria-label="WhatsApp"
      onClick={(e) => {
        e.stopPropagation();
        window.open(
          buildWhatsAppUrl({
            customerName: booking.customer_name,
            customerPhone: booking.customer_phone!,
            vehicleName,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            deliveryLocation: booking.delivery_location ?? undefined,
            totalPrice: Number(booking.total_price) || undefined,
          }),
          "_blank",
        );
      }}
    >
      <MessageCircle className="h-4.5 w-4.5" />
    </Button>
  );
}
