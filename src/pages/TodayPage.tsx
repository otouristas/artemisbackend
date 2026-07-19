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
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => navigate("/booking/new")}>
            Νέα κράτηση
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Αφίξεις", value: arrivals.length, icon: LogIn, tone: "text-success" },
          { label: "Αναχωρήσεις", value: departures.length, icon: LogOut, tone: "text-accent" },
          { label: "Εκκρεμείς", value: pending.length, icon: Clock, tone: "text-warning" },
          { label: "Υπόλοιπα", value: overdueBalances.length, icon: AlertCircle, tone: "text-destructive" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <stat.icon className={cn("h-3.5 w-3.5", stat.tone)} />
              {stat.label}
            </div>
            <p className="font-display text-3xl tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4 mb-6">
        <p className="text-xs font-medium text-muted-foreground mb-3">Πληρότητα 7 ημερών</p>
        <div className="grid grid-cols-7 gap-2">
          {occupancyDays.map((d) => (
            <div key={d.day.toISOString()} className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1 capitalize">
                {format(d.day, "EEE", { locale: el })}
              </p>
              <div className="h-16 rounded-lg bg-muted/60 flex items-end overflow-hidden">
                <div
                  className="w-full bg-primary/80 transition-all"
                  style={{ height: `${Math.max(d.pct, 4)}%` }}
                  title={`${d.booked}/${d.total}`}
                />
              </div>
              <p className="text-[10px] mt-1 font-medium">{d.pct}%</p>
            </div>
          ))}
        </div>
      </div>

      {quiet ? (
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/95 via-primary to-[#123a52] text-primary-foreground px-6 py-12 text-center">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,#c9833a,transparent_45%),radial-gradient(circle_at_80%_70%,#f7f4ef,transparent_40%)]" />
          <Sun className="relative h-8 w-8 mx-auto mb-3 text-accent" />
          <h2 className="relative font-display text-2xl mb-2">Ήσυχη μέρα στο νησί</h2>
          <p className="relative text-sm text-primary-foreground/75 max-w-md mx-auto mb-5">
            Δεν υπάρχουν αφίξεις, αναχωρήσεις ή εκκρεμότητες για σήμερα. Μπορείτε να προγραμματίσετε νέα κράτηση.
          </p>
          <Button
            variant="secondary"
            className="relative"
            onClick={() => navigate("/booking/new")}
          >
            Νέα κράτηση
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <ActionSection
            title="Αφίξεις σήμερα"
            icon={LogIn}
            items={arrivals}
            vehicleMap={vehicleMap}
            onOpen={openBooking}
          />
          <ActionSection
            title="Αναχωρήσεις σήμερα"
            icon={LogOut}
            items={departures}
            vehicleMap={vehicleMap}
            onOpen={openBooking}
            showBalance
          />
          <ActionSection
            title="Εκκρεμείς επιβεβαιώσεις"
            icon={Clock}
            items={pending}
            vehicleMap={vehicleMap}
            onOpen={openBooking}
          />
          <ActionSection
            title="Ανοιχτά υπόλοιπα"
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
  icon: Icon,
  items,
  vehicleMap,
  onOpen,
  showBalance,
}: {
  title: string;
  icon: typeof LogIn;
  items: Booking[];
  vehicleMap: Record<string, { name: string }>;
  onOpen: (b: Booking) => void;
  showBalance?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
        <span className="text-muted-foreground font-normal">({items.length})</span>
      </h2>
      <div className="rounded-xl border bg-card divide-y">
        {items.map((b) => {
          const balance = (Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0);
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => onOpen(b)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{b.customer_name}</p>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_CHIP[b.status])}>
                    {STATUS_LABELS[b.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {vehicleMap[b.vehicle_id]?.name}
                  {b.delivery_location ? ` · ${b.delivery_location}` : ""}
                  {showBalance && balance > 0 ? ` · υπόλοιπο ${balance}€` : ""}
                </p>
              </div>
              {b.customer_phone && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-success"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      buildWhatsAppUrl({
                        customerName: b.customer_name,
                        customerPhone: b.customer_phone!,
                        vehicleName: vehicleMap[b.vehicle_id]?.name ?? "",
                        checkIn: b.check_in,
                        checkOut: b.check_out,
                        deliveryLocation: b.delivery_location ?? undefined,
                        totalPrice: Number(b.total_price) || undefined,
                      }),
                      "_blank",
                    );
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
