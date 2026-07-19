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
          { label: "Αφίξεις", value: arrivals.length, icon: LogIn, tone: "text-success bg-success/10 border-success/20" },
          { label: "Αναχωρήσεις", value: departures.length, icon: LogOut, tone: "text-accent bg-accent/10 border-accent/20" },
          { label: "Εκκρεμείς", value: pending.length, icon: Clock, tone: "text-warning bg-warning/10 border-warning/20" },
          { label: "Υπόλοιπα", value: overdueBalances.length, icon: AlertCircle, tone: "text-destructive bg-destructive/10 border-destructive/20" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-md px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
              <span className={cn("p-1 rounded-lg border", stat.tone)}>
                <stat.icon className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">{stat.label}</span>
            </div>
            <p className="font-display text-3xl font-bold tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-md p-4 mb-6 shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Πληρότητα 7 ημερών</p>
        <div className="grid grid-cols-7 gap-3">
          {occupancyDays.map((d) => (
            <div key={d.day.toISOString()} className="text-center flex flex-col justify-between">
              <p className="text-[10px] text-muted-foreground mb-1.5 capitalize font-medium">
                {format(d.day, "EEE", { locale: el })}
              </p>
              <div className="h-20 rounded-lg bg-muted/40 flex items-end overflow-hidden">
                <div
                  className="w-full bg-accent/80 hover:bg-accent transition-all rounded-t-sm"
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
      <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-md divide-y divide-border/20 overflow-hidden shadow-sm">
        {items.map((b) => {
          const balance = (Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0);
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-all cursor-pointer touch-target select-none duration-150 active:scale-[0.99]"
              onClick={() => onOpen(b)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate text-foreground">{b.customer_name}</p>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0.5", STATUS_CHIP[b.status])}>
                    {STATUS_LABELS[b.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {vehicleMap[b.vehicle_id]?.name}
                  {b.delivery_location ? ` · ${b.delivery_location}` : ""}
                  {showBalance && balance > 0 ? ` · υπόλοιπο ${balance}€` : ""}
                </p>
              </div>
              {b.customer_phone && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-success h-9 w-9 rounded-xl active:bg-success/15 active:scale-[0.92] transition-all"
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
                  <MessageCircle className="h-4.5 w-4.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
