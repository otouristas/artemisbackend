import { useMemo, useState, type ReactNode } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bike,
  Car,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  SearchX,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  SOURCE_LABELS,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_PILL,
  finance,
  initials,
  isoDay,
  money,
  rentalDays,
  todayStart,
} from "@/components/bookings/bookingUtils";

interface BookingListViewProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onOpen: (booking: Booking) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

type SortKey = "customer" | "vehicle" | "check_in" | "status" | "total";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = { pending: 0, confirmed: 1, cancelled: 2 };

function openWhatsApp(b: Booking, v: Vehicle | undefined) {
  if (!b.customer_phone) return;
  window.open(
    buildWhatsAppUrl({
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      vehicleName: v?.name ?? "",
      checkIn: b.check_in,
      checkOut: b.check_out,
      deliveryLocation: b.delivery_location || undefined,
      totalPrice: b.total_price || undefined,
    }),
    "_blank",
  );
}

/** "Σήμερα", "σε 3 ημ.", "Σε εξέλιξη", or nothing for the past. */
function timing(b: Booking, todayKey: string): { label: string; tone: string } | null {
  if (b.status === "cancelled") return null;
  if (b.check_in === todayKey) return { label: "Παραλαβή σήμερα", tone: "text-success" };
  if (b.check_out === todayKey) return { label: "Επιστροφή σήμερα", tone: "text-accent" };
  if (b.check_in < todayKey && b.check_out > todayKey) return { label: "Σε ενοικίαση", tone: "text-primary" };
  if (b.check_in > todayKey) {
    const d = differenceInCalendarDays(parseISO(b.check_in), parseISO(todayKey));
    if (d <= 14) return { label: d === 1 ? "Αύριο" : `Σε ${d} ημ.`, tone: "text-muted-foreground" };
  }
  return null;
}

export function BookingListView({ bookings, vehicles, onOpen, onEdit, onDelete }: BookingListViewProps) {
  const isMobile = useIsMobile();
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const [sortKey, setSortKey] = useState<SortKey>("check_in");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const todayKey = isoDay(todayStart());

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...bookings].sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case "customer":
          r = a.customer_name.localeCompare(b.customer_name, "el");
          break;
        case "vehicle":
          r = (vehicleMap.get(a.vehicle_id)?.name ?? "").localeCompare(vehicleMap.get(b.vehicle_id)?.name ?? "", "el");
          break;
        case "status":
          r = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
          break;
        case "total":
          r = (Number(a.total_price) || 0) - (Number(b.total_price) || 0);
          break;
        default:
          r = a.check_in.localeCompare(b.check_in);
      }
      return r * dir || a.check_in.localeCompare(b.check_in);
    });
  }, [bookings, sortKey, sortDir, vehicleMap]);

  const totals = useMemo(() => {
    let revenue = 0;
    let outstanding = 0;
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const f = finance(b);
      revenue += f.total;
      outstanding += f.remaining;
    }
    return { revenue, outstanding };
  }, [bookings]);

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "check_in" || key === "total" ? "desc" : "asc");
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-16 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="h-5 w-5" />
        </span>
        <div className="text-sm font-semibold">Δεν βρέθηκαν κρατήσεις</div>
        <p className="mt-1 text-sm text-muted-foreground">Δοκιμάστε άλλο φίλτρο ή αναζήτηση.</p>
      </div>
    );
  }

  // ── Mobile: cards ─────────────────────────────────────
  if (isMobile) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{bookings.length} κρατήσεις</span>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-1 font-medium text-foreground"
          >
            {sortDir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            {sortDir === "desc" ? "Νεότερες πρώτα" : "Παλαιότερες πρώτα"}
          </button>
        </div>
        {sorted.map((b) => {
          const v = vehicleMap.get(b.vehicle_id);
          const f = finance(b);
          const t = timing(b, todayKey);
          const Icon = v?.type === "scooter" ? Bike : Car;
          return (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(b)}
              onKeyDown={(e) => e.key === "Enter" && onOpen(b)}
              className={cn(
                "pressable rounded-2xl border bg-card p-3.5 shadow-sm",
                b.status === "cancelled" && "opacity-70",
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar name={b.customer_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold">{b.customer_name}</span>
                    <StatusPill status={b.status} compact />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{v?.name ?? "—"}</span>
                    {b.plate && <PlateChip plate={b.plate} />}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-[13px]">
                <span className="font-semibold capitalize">{format(parseISO(b.check_in), "EEE d MMM", { locale: el })}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold capitalize">{format(parseISO(b.check_out), "EEE d MMM", { locale: el })}</span>
                <span className="ml-auto text-xs text-muted-foreground">{rentalDays(b)} ημ.</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold tabular-nums">{f.total > 0 ? money(f.total) : "—"}</div>
                  <div className="text-[11px]">
                    {t ? (
                      <span className={cn("font-medium", t.tone)}>{t.label}</span>
                    ) : f.total > 0 ? (
                      f.remaining > 0 ? (
                        <span className="text-warning">Υπόλοιπο {money(f.remaining)}</span>
                      ) : (
                        <span className="text-success">Εξοφλημένη</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">Χωρίς ποσό</span>
                    )}
                  </div>
                </div>
                {b.customer_phone && (
                  <>
                    <a
                      href={`tel:${b.customer_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-10 w-10 items-center justify-center rounded-full border bg-card"
                      aria-label="Κλήση"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsApp(b, v);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-success"
                      aria-label="WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  </>
                )}
                <RowMenu b={b} v={v} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} round />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Desktop: dense sortable table ────────────────────
  const Th = ({ k, children, className }: { k?: SortKey; children: ReactNode; className?: string }) => (
    <th className={cn("sticky top-0 z-10 bg-muted/70 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur", className)}>
      {k ? (
        <button
          type="button"
          onClick={() => setSort(k)}
          className={cn("inline-flex items-center gap-1 hover:text-foreground", sortKey === k && "text-foreground")}
        >
          {children}
          {sortKey === k ? (
            sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="max-h-[calc(100dvh-330px)] min-h-[320px] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b">
              <Th k="customer" className="pl-4">Πελάτης</Th>
              <Th k="vehicle">Όχημα</Th>
              <Th k="check_in">Ημερομηνίες</Th>
              <Th k="status">Κατάσταση</Th>
              <Th>Πηγή</Th>
              <Th k="total" className="text-right">
                Σύνολο
              </Th>
              <Th className="w-[120px] pr-4 text-right">
                <span className="sr-only">Ενέργειες</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const v = vehicleMap.get(b.vehicle_id);
              const f = finance(b);
              const t = timing(b, todayKey);
              const Icon = v?.type === "scooter" ? Bike : Car;
              return (
                <tr
                  key={b.id}
                  onClick={() => onOpen(b)}
                  className={cn(
                    "group cursor-pointer border-b border-border/70 transition-colors last:border-b-0 hover:bg-muted/40",
                    b.status === "cancelled" && "text-muted-foreground",
                  )}
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.customer_name} />
                      <div className="min-w-0">
                        <div className={cn("truncate font-semibold text-foreground", b.status === "cancelled" && "line-through decoration-muted-foreground/50")}>
                          {b.customer_name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {b.customer_phone || b.customer_email || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-foreground">{v?.name ?? "—"}</span>
                      {b.plate && <PlateChip plate={b.plate} />}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center gap-1.5 font-medium capitalize text-foreground">
                      {format(parseISO(b.check_in), "EEE d MMM", { locale: el })}
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {format(parseISO(b.check_out), "EEE d MMM", { locale: el })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(b.check_in), "yyyy")} · {rentalDays(b)} ημ.
                      {t && <span className={cn("ml-1.5 font-medium", t.tone)}>· {t.label}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={b.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {b.booking_source ? SOURCE_LABELS[b.booking_source] ?? b.booking_source : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    {f.total > 0 ? (
                      <>
                        <div className="font-semibold tabular-nums text-foreground">{money(f.total)}</div>
                        {f.remaining > 0 ? (
                          <div className="text-xs text-warning">Υπόλ. {money(f.remaining)}</div>
                        ) : (
                          <div className="text-xs text-success">Εξοφλημένη</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 pr-4">
                    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {b.customer_phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-success opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                          title="WhatsApp"
                          onClick={() => openWhatsApp(b, v)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        title="Επεξεργασία"
                        onClick={() => onEdit(b)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <RowMenu b={b} v={v} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{bookings.length}</span> κρατήσεις
        </span>
        <span>
          Σύνολο <span className="font-semibold tabular-nums text-foreground">{money(totals.revenue)}</span>
        </span>
        <span>
          Ανεξόφλητα <span className="font-semibold tabular-nums text-warning">{money(totals.outstanding)}</span>
        </span>
        <span className="ml-auto">χωρίς τις ακυρωμένες</span>
      </div>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials(name)}
    </span>
  );
}

function PlateChip({ plate }: { plate: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border bg-background px-1.5 py-px font-mono text-[11px] font-medium tracking-wide text-foreground">
      {plate}
    </span>
  );
}

function StatusPill({ status, compact }: { status: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        STATUS_PILL[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function RowMenu({
  b,
  v,
  onOpen,
  onEdit,
  onDelete,
  round,
}: {
  b: Booking;
  v: Vehicle | undefined;
  onOpen: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onDelete: (b: Booking) => void;
  round?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground",
            round ? "h-10 w-10 rounded-full border bg-card" : "h-8 w-8 rounded-md",
          )}
          aria-label="Ενέργειες"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onOpen(b)}>
          <Eye className="mr-2 h-4 w-4" /> Προβολή
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(b)}>
          <Pencil className="mr-2 h-4 w-4" /> Επεξεργασία
        </DropdownMenuItem>
        {b.customer_phone && (
          <DropdownMenuItem onClick={() => openWhatsApp(b, v)}>
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(b)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Διαγραφή
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
