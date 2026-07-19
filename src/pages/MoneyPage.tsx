import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  endOfMonth,
  format,
  isToday,
  isWithinInterval,
  parseISO,
  startOfMonth,
} from "date-fns";
import { el } from "date-fns/locale";
import { Wallet, ArrowDownLeft, ArrowUpRight, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { cn } from "@/lib/utils";

export default function MoneyPage() {
  const navigate = useNavigate();
  const { data: bookings = [], isLoading } = useBookings();
  const { data: vehicles = [] } = useVehicles();
  const [month] = useState(new Date());

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const monthBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status === "cancelled") return false;
        const checkIn = parseISO(b.check_in);
        const checkOut = parseISO(b.check_out);
        return (
          isWithinInterval(checkIn, { start: monthStart, end: monthEnd }) ||
          isWithinInterval(checkOut, { start: monthStart, end: monthEnd }) ||
          (checkIn <= monthStart && checkOut >= monthEnd)
        );
      }),
    [bookings, monthStart, monthEnd],
  );

  const expected = monthBookings.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  const collected = monthBookings.reduce((s, b) => s + (Number(b.deposit_amount) || 0), 0);
  const remaining = expected - collected;

  const openBalances = useMemo(
    () =>
      bookings
        .filter((b) => {
          if (b.status === "cancelled") return false;
          return (Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0) > 0;
        })
        .map((b) => ({
          ...b,
          balance: (Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0),
        }))
        .sort((a, b) => b.balance - a.balance),
    [bookings],
  );

  const checkoutToday = openBalances.filter((b) => isToday(parseISO(b.check_out)));

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageHeader
        title="Οικονομικά"
        subtitle={`Ταμείο · ${format(month, "LLLL yyyy", { locale: el })}`}
      />

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Kpi
              icon={Wallet}
              label="Αναμενόμενα"
              value={`${expected}€`}
              tone="text-primary"
            />
            <Kpi
              icon={ArrowDownLeft}
              label="Εισπραγμένα"
              value={`${collected}€`}
              tone="text-success"
            />
            <Kpi
              icon={ArrowUpRight}
              label="Υπόλοιπο μήνα"
              value={`${remaining}€`}
              tone="text-accent"
            />
          </div>

          {checkoutToday.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-accent" />
                Υπόλοιπα με checkout σήμερα
              </h2>
              <BalanceList
                items={checkoutToday}
                vehicleMap={vehicleMap}
                onOpen={(id) => navigate(`/booking/${id}`)}
              />
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold mb-2">
              Ανοιχτά υπόλοιπα ({openBalances.length})
            </h2>
            {openBalances.length === 0 ? (
              <div className="rounded-2xl border bg-card px-6 py-10 text-center">
                <p className="font-display text-xl mb-1">Όλα εξοφλημένα</p>
                <p className="text-sm text-muted-foreground">Δεν υπάρχουν ανοιχτά υπόλοιπα.</p>
              </div>
            ) : (
              <BalanceList
                items={openBalances}
                vehicleMap={vehicleMap}
                onOpen={(id) => navigate(`/booking/${id}`)}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        {label}
      </div>
      <p className="font-display text-3xl tracking-tight">{value}</p>
    </div>
  );
}

function BalanceList({
  items,
  vehicleMap,
  onOpen,
}: {
  items: Array<{
    id: string;
    customer_name: string;
    vehicle_id: string;
    check_out: string;
    total_price: number | null;
    deposit_amount: number | null;
    payment_notes: string | null;
    balance: number;
  }>;
  vehicleMap: Record<string, { name: string }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="inset-group border">
      {items.map((b) => (
        <button
          key={b.id}
          onClick={() => onOpen(b.id)}
          className="pressable w-full text-left flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-muted/40 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{b.customer_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {vehicleMap[b.vehicle_id]?.name} · checkout {format(parseISO(b.check_out), "dd/MM")}
              {b.payment_notes ? ` · ${b.payment_notes}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-accent">{b.balance}€</p>
            <Badge variant="outline" className="text-[10px] mt-0.5">
              από {Number(b.total_price) || 0}€
            </Badge>
          </div>
        </button>
      ))}
    </div>
  );
}
