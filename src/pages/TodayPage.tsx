import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  format,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { el } from "date-fns/locale";
import {
  LogIn,
  LogOut,
  AlertCircle,
  MessageCircle,
  Clock,
  Sun,
  Car,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { STATUS_CHIP, STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";

export default function TodayPage() {
  const navigate = useNavigate();
  const { data: bookings = [], isLoading: loadingBookings } = useBookings();
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const isLoading = loadingBookings || loadingVehicles;

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const today = startOfDay(new Date());

  const arrivals = useMemo(
    () => bookings.filter((b) => isToday(parseISO(b.check_in)) && b.status !== "cancelled"),
    [bookings],
  );
  const departures = useMemo(
    () => bookings.filter((b) => isToday(parseISO(b.check_out)) && b.status !== "cancelled"),
    [bookings],
  );
  const pending = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings],
  );
  const overdueBalances = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status === "cancelled") return false;
        const total = Number(b.total_price) || 0;
        const deposit = Number(b.deposit_amount) || 0;
        return total - deposit > 0 && (isToday(parseISO(b.check_out)) || parseISO(b.check_out) < today);
      }),
    [bookings, today],
  );

  const occupancyDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i);
      const booked = vehicles.filter((v) =>
        bookings.some((b) => {
          if (b.status === "cancelled" || b.vehicle_id !== v.id) return false;
          return isWithinInterval(day, {
            start: startOfDay(parseISO(b.check_in)),
            end: startOfDay(parseISO(b.check_out)),
          });
        }),
      ).length;
      return {
        day,
        booked,
        total: vehicles.length,
        pct: vehicles.length ? Math.round((booked / vehicles.length) * 100) : 0,
      };
    });
  }, [bookings, vehicles, today]);

  const openBooking = (b: Booking) => navigate(`/booking/${b.id}`);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const quiet =
    arrivals.length === 0 &&
    departures.length === 0 &&
    pending.length === 0 &&
    overdueBalances.length === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageHeader
        title="Σήμερα"
        subtitle={format(new Date(), "EEEE d MMMM yyyy", { locale: el })}
        actions={
          <Button className="rounded-full px-5" onClick={() => navigate("/booking/new")}>
            Νέα κράτηση
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Αφίξεις", value: arrivals.length, icon: LogIn, tone: "text-success" },
          { label: "Αναχωρήσεις", value: departures.length, icon: LogOut, tone: "text-accent" },
          { label: "Εκκρεμείς", value: pending.length, icon: Clock, tone: "text-warning" },
          { label: "Υπόλοιπα", value: overdueBalances.length, icon: AlertCircle, tone: "text-destructive" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="font-medium">{stat.label}</span>
              <stat.icon className={cn("h-4 w-4", stat.tone)} />
            </div>
            <p className="mt-2 text-[32px] leading-none font-bold tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 mb-10">
        <p className="text-base font-semibold mb-4">Πληρότητα 7 ημερών</p>
        <div className="grid grid-cols-7 gap-3">
          {occupancyDays.map((d) => (
            <div key={d.day.toISOString()} className="text-center flex flex-col justify-between">
              <p className="text-[10px] text-muted-foreground mb-1.5 capitalize font-medium">
                {format(d.day, "EEE", { locale: el })}
              </p>
              <div className="h-20 rounded-md bg-muted flex items-end overflow-hidden">
                <div
                  className="w-full bg-primary/85 hover:bg-primary transition-all rounded-t-sm"
                  style={{ height: `${Math.max(d.pct, 4)}%` }}
                  title={`${d.booked}/${d.total}`}
                />
              </div>
              <p className="text-[10px] mt-1.5 font-semibold">{d.pct}%</p>
            </div>
          ))}
        </div>
      </div>

      {quiet ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <Sun className="h-8 w-8 mx-auto mb-3 text-accent" />
          <h2 className="text-2xl font-bold tracking-tight mb-2">Ήσυχη μέρα στο νησί</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            Δεν υπάρχουν αφίξεις, αναχωρήσεις ή εκκρεμότητες για σήμερα. Μπορείτε να προγραμματίσετε νέα κράτηση.
          </p>
          <Button className="rounded-full px-5" onClick={() => navigate("/booking/new")}>
            Νέα κράτηση
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          <ActionSection
            title="Αφίξεις σήμερα"
            pill="Παραλαβή σήμερα"
            pillTone="bg-success/10 text-success"
            icon={LogIn}
            items={arrivals}
            vehicleMap={vehicleMap}
            onOpen={openBooking}
          />
          <ActionSection
            title="Αναχωρήσεις σήμερα"
            pill="Επιστροφή σήμερα"
            pillTone="bg-accent/10 text-accent"
            icon={LogOut}
            items={departures}
            vehicleMap={vehicleMap}
            onOpen={openBooking}
            showBalance
          />
          <ActionSection
            title="Εκκρεμείς επιβεβαιώσεις"
            pill="Θέλει επιβεβαίωση"
            pillTone="bg-warning/10 text-warning"
            icon={Clock}
            items={pending}
            vehicleMap={vehicleMap}
            onOpen={openBooking}
          />
          <ActionSection
            title="Ανοιχτά υπόλοιπα"
            pill="Υπόλοιπο ανοιχτό"
            pillTone="bg-destructive/10 text-destructive"
            icon={AlertCircle}
            items={overdueBalances}
            vehicleMap={vehicleMap}
            onOpen={openBooking}
            showBalance
          />
        </div>
      )}
    </div>
  );
}

function ActionSection({
  title,
  pill,
  pillTone,
  icon: Icon,
  items,
  vehicleMap,
  onOpen,
  showBalance,
}: {
  title: string;
  pill: string;
  pillTone: string;
  icon: typeof LogIn;
  items: Booking[];
  vehicleMap: Record<string, { name: string; image_url?: string | null }>;
  onOpen: (b: Booking) => void;
  showBalance?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 border-b border-border pb-3 mb-4 text-lg font-semibold">
        <Icon className="h-4.5 w-4.5 text-muted-foreground" />
        {title}
        <span className="text-muted-foreground font-normal">({items.length})</span>
      </h2>
      <div className="space-y-3">
        {items.map((b) => {
          const balance = (Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0);
          const vehicle = vehicleMap[b.vehicle_id];
          return (
            <div
              key={b.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-foreground/25 hover:shadow-[0_6px_20px_hsl(204_69%_14%/0.07)] cursor-pointer touch-target select-none active:scale-[0.995]"
              onClick={() => onOpen(b)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", pillTone)}>{pill}</span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_CHIP[b.status])}>
                    {STATUS_LABELS[b.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-base font-semibold truncate text-foreground">{vehicle?.name ?? "Όχημα"}</p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {b.customer_name}
                  {b.delivery_location ? ` · ${b.delivery_location}` : ""}
                  {showBalance && balance > 0 ? ` · υπόλοιπο ${balance}€` : ""}
                </p>
              </div>
              {b.customer_phone && (
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0 text-success h-10 w-10 rounded-full"
                  aria-label="WhatsApp"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      buildWhatsAppUrl({
                        customerName: b.customer_name,
                        customerPhone: b.customer_phone!,
                        vehicleName: vehicle?.name ?? "",
                        checkIn: b.check_in,
                        checkOut: b.check_out,
                        deliveryLocation: b.delivery_location ?? undefined,
                        totalPrice: Number(b.total_price) || undefined,
                      }),
                      "_blank",
                    );
                  }}
                >
                  <MessageCircle className="h-4.5 w-4.5" />
                </Button>
              )}
              <div className="hidden sm:flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {vehicle?.image_url ? (
                  <img src={vehicle.image_url} alt={vehicle.name} className="h-full w-full object-cover" />
                ) : (
                  <Car className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
