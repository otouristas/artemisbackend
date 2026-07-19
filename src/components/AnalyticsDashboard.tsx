import { useMemo } from "react";
import { parseISO, differenceInDays, isWithinInterval, startOfMonth, endOfMonth, format } from "date-fns";
import { el } from "date-fns/locale";
import { BarChart3, TrendingUp, Car, CalendarCheck, Users, DollarSign, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";

interface AnalyticsDashboardProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  currentMonth: Date;
}

const COLORS = [
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(217, 91%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(180, 70%, 45%)",
];

export function AnalyticsDashboard({ bookings, vehicles, currentMonth }: AnalyticsDashboardProps) {
  const isMobile = useIsMobile();
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
    [bookings, monthStart, monthEnd]
  );

  const stats = useMemo(() => {
    const activeBookings = monthBookings.length;
    const confirmedBookings = monthBookings.filter((b) => b.status === "confirmed").length;
    const pendingBookings = monthBookings.filter((b) => b.status === "pending").length;

    const totalRevenue = monthBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
    const totalDeposits = monthBookings.reduce((sum, b) => sum + (Number(b.deposit_amount) || 0), 0);
    const remainingBalance = totalRevenue - totalDeposits;

    const totalDays = monthBookings.reduce((sum, b) => {
      const days = differenceInDays(parseISO(b.check_out), parseISO(b.check_in));
      return sum + Math.max(days, 1);
    }, 0);

    const avgDailyRate = totalDays > 0 ? Math.round(totalRevenue / totalDays) : 0;
    const uniqueCustomers = new Set(monthBookings.map((b) => b.customer_name.toLowerCase())).size;

    // Occupancy rate: (booked vehicle-days) / (total vehicle-days in month)
    const daysInMonth = endOfMonth(currentMonth).getDate();
    const totalVehicleDays = vehicles.length * daysInMonth;
    const occupancy = totalVehicleDays > 0 ? Math.round((totalDays / totalVehicleDays) * 100) : 0;

    return { activeBookings, confirmedBookings, pendingBookings, totalRevenue, totalDeposits, remainingBalance, totalDays, uniqueCustomers, avgDailyRate, occupancy };
  }, [monthBookings, vehicles.length, currentMonth]);

  // Vehicle type distribution
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
    return Object.entries(typeCount).map(([name, value]) => ({ name, value }));
  }, [monthBookings, vehicles]);

  // Status distribution
  const statusData = useMemo(() => [
    { name: "Επιβεβαιωμένες", value: stats.confirmedBookings, color: "hsl(142, 76%, 36%)" },
    { name: "Εκκρεμείς", value: stats.pendingBookings, color: "hsl(38, 92%, 50%)" },
  ].filter(d => d.value > 0), [stats]);

  // Booking source distribution
  const sourceData = useMemo(() => {
    const sourceCount: Record<string, number> = {};
    monthBookings.forEach((b) => {
      const src = (b as any).booking_source || "phone";
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    });
    const sourceLabels: Record<string, string> = {
      phone: "Τηλέφωνο",
      walkin: "Walk-in",
      online: "Online",
      email: "Email",
    };
    return Object.entries(sourceCount).map(([key, value]) => ({
      name: sourceLabels[key] || key,
      value,
    }));
  }, [monthBookings]);

  const monthLabel = format(currentMonth, "LLLL yyyy", { locale: el });
  const chartHeight = isMobile ? 180 : 220;

  return (
    <div className="space-y-4 mb-6">
      <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Στατιστικά — {monthLabel}
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1">
              <CalendarCheck className="h-3.5 w-3.5" /> Κρατήσεις
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.activeBookings}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{stats.confirmedBookings} επιβ. / {stats.pendingBookings} εκκρ.</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ημέρες ενοικ.
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.totalDays}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Πελάτες
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.uniqueCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Έσοδα
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.totalRevenue}€</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Προκ. {stats.totalDeposits}€ · Υπόλ. {stats.remainingBalance}€</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Μ.Ο./ημέρα
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.avgDailyRate}€</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1">
              <Percent className="h-3.5 w-3.5" /> Πληρότητα
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.occupancy}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {(vehicleTypeData.length > 0 || statusData.length > 0 || sourceData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicleTypeData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Car className="h-4 w-4" /> Κρατήσεις ανά όχημα
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={vehicleTypeData}>
                    <XAxis dataKey="name" tick={{ fontSize: isMobile ? 8 : 10 }} angle={-20} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {statusData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Κατάσταση κρατήσεων</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 50} outerRadius={isMobile ? 65 : 80} dataKey="value" label>
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {sourceData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Πηγή κρατήσεων</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 50} outerRadius={isMobile ? 65 : 80} dataKey="value" label>
                      {sourceData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
