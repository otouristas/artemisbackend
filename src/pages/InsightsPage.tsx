import { useMemo, useState } from "react";
import {
  parseISO,
  differenceInDays,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { el } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, CalendarCheck, Users, Percent } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { useIsMobile } from "@/hooks/use-mobile";

const ARTEMIS_COLORS = [
  "hsl(204, 69%, 14%)",
  "hsl(30, 57%, 51%)",
  "hsl(95, 22%, 28%)",
  "hsl(204, 40%, 40%)",
  "hsl(39, 29%, 55%)",
  "hsl(30, 45%, 40%)",
];

function seasonForDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // Artemis rates: low / shoulder / mid / peak
  if (m === 10 || m <= 4 || (m === 5 && day <= 10)) return "Χαμηλή";
  if ((m === 5 && day >= 11) || (m === 6 && day <= 10) || (m === 9 && day >= 11)) return "Μεταβατική";
  if ((m === 6 && day >= 11) || (m === 7 && day <= 10)) return "Μεσαία";
  if ((m === 7 && day >= 11) || m === 8 || (m === 9 && day <= 10)) return "Αιχμή";
  return "Χαμηλή";
}

export default function InsightsPage() {
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: bookings = [], isLoading: loadingB } = useBookings();
  const { data: vehicles = [], isLoading: loadingV } = useVehicles();
  const isLoading = loadingB || loadingV;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const checkIn = parseISO(b.check_in);
        const checkOut = parseISO(b.check_out);
        return (
          b.status !== "cancelled" &&
          (isWithinInterval(checkIn, { start: monthStart, end: monthEnd }) ||
            isWithinInterval(checkOut, { start: monthStart, end: monthEnd }) ||
            (checkIn <= monthStart && checkOut >= monthEnd))
        );
      }),
    [bookings, monthStart, monthEnd],
  );

  const stats = useMemo(() => {
    const totalRevenue = monthBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
    const totalDays = monthBookings.reduce((sum, b) => {
      const days = differenceInDays(parseISO(b.check_out), parseISO(b.check_in));
      return sum + Math.max(days, 1);
    }, 0);
    const uniqueCustomers = new Set(monthBookings.map((b) => b.customer_name.toLowerCase())).size;
    const avgStay = monthBookings.length ? Math.round((totalDays / monthBookings.length) * 10) / 10 : 0;
    const daysInMonth = endOfMonth(currentMonth).getDate();
    const occupancy =
      vehicles.length > 0 ? Math.round((totalDays / (vehicles.length * daysInMonth)) * 100) : 0;
    const arrivals = monthBookings.filter((b) => {
      const ci = parseISO(b.check_in);
      return ci >= monthStart && ci <= monthEnd;
    }).length;
    return { totalRevenue, occupancy, arrivals, avgStay, uniqueCustomers, totalDays };
  }, [monthBookings, vehicles.length, currentMonth, monthStart, monthEnd]);

  const vehicleTypeData = useMemo(() => {
    const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
    const typeCount: Record<string, number> = {};
    monthBookings.forEach((b) => {
      const v = vehicleMap[b.vehicle_id];
      if (v) {
        const baseName = v.name.replace(/ #\d+$/, "");
        typeCount[baseName] = (typeCount[baseName] || 0) + 1;
      }
    });
    return Object.entries(typeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [monthBookings, vehicles]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthBookings.forEach((b) => {
      const s = b.booking_source || "phone";
      counts[s] = (counts[s] || 0) + 1;
    });
    const labels: Record<string, string> = {
      phone: "Τηλέφωνο",
      walkin: "Walk-in",
      online: "Online",
      email: "Email",
    };
    return Object.entries(counts).map(([key, value]) => ({
      name: labels[key] || key,
      value,
    }));
  }, [monthBookings]);

  const season = seasonForDate(currentMonth);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageHeader
        title="Στατιστικά"
        subtitle={`Περίοδος: ${season}`}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-semibold capitalize">
              {format(currentMonth, "LLLL yyyy", { locale: el })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex gap-2 overflow-x-auto mb-5">
        {["Χαμηλή", "Μεταβατική", "Μεσαία", "Αιχμή"].map((s) => (
          <div
            key={s}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
              s === season ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi icon={TrendingUp} label="Έσοδα" value={`${stats.totalRevenue}€`} />
        <Kpi icon={Percent} label="Πληρότητα" value={`${stats.occupancy}%`} />
        <Kpi icon={CalendarCheck} label="Αφίξεις" value={`${stats.arrivals}`} />
        <Kpi icon={Users} label="Μέση διαμονή" value={`${stats.avgStay} ημ.`} />
      </div>

      {monthBookings.length === 0 ? (
        <div className="rounded-2xl border bg-card px-6 py-12 text-center">
          <p className="font-display text-xl mb-2">Χωρίς δεδομένα αυτόν τον μήνα</p>
          <p className="text-sm text-muted-foreground">
            Προσθέστε κρατήσεις για να δείτε κατανομή οχημάτων και πηγές.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="font-display text-lg mb-3">Οχήματα</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehicleTypeData} layout={isMobile ? "vertical" : "horizontal"}>
                  {isMobile ? (
                    <>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                    </>
                  ) : (
                    <>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    </>
                  )}
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(204, 69%, 14%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <h2 className="font-display text-lg mb-3">Πηγές</h2>
            {sourceData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">Δεν υπάρχουν δεδομένα πηγών.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={ARTEMIS_COLORS[i % ARTEMIS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="font-display text-2xl md:text-3xl tracking-tight">{value}</p>
    </div>
  );
}
