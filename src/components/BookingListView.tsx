import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { el } from "date-fns/locale";
import { Edit2, Trash2, Eye, Phone, Mail, MessageSquare, CreditCard, Download, MessageCircle, MapPin } from "lucide-react";
import { BookingPreviewSheet } from "@/components/BookingPreviewSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Vehicle } from "@/hooks/useVehicles";
import type { Booking } from "@/hooks/useBookings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface BookingListViewProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onEdit: (booking: Booking) => void;
  onDelete: (id: string) => void;
  filterVehicle: string;
  onFilterVehicleChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  confirmed: "Επιβεβαιωμένη",
  cancelled: "Ακυρωμένη",
};

const STATUS_VARIANT: Record<string, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export function BookingListView({
  bookings,
  vehicles,
  onEdit,
  onDelete,
  filterVehicle,
  onFilterVehicleChange,
  filterStatus,
  onFilterStatusChange,
}: BookingListViewProps) {
  const isMobile = useIsMobile();
  const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  // Preview state
  const [previewTarget, setPreviewTarget] = useState<Booking | null>(null);

  const filtered = bookings.filter((b) => {
    if (filterVehicle && filterVehicle !== "all" && b.vehicle_id !== filterVehicle) return false;
    if (filterStatus && filterStatus !== "all" && b.status !== filterStatus) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ["Πελάτης", "Τηλέφωνο", "Email", "Όχημα", "Check-in", "Check-out", "Κατάσταση", "Ποσό", "Προκαταβολή", "Σχόλια", "Πληρωμή"];
    const rows = filtered.map((b) => [
      b.customer_name,
      b.customer_phone || "",
      b.customer_email || "",
      vehicleMap[b.vehicle_id]?.name || "",
      b.check_in,
      b.check_out,
      STATUS_LABELS[b.status] || b.status,
      String(b.total_price || 0),
      String(b.deposit_amount || 0),
      b.comments || "",
      b.payment_notes || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Το αρχείο CSV εξήχθη!");
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
        <Select value={filterVehicle} onValueChange={onFilterVehicleChange}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Όλα τα οχήματα" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλα τα οχήματα</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Όλες οι καταστάσεις" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 flex-1 sm:flex-none" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            <span>Εξαγωγή CSV</span>
          </Button>
          <Badge variant="secondary" className="hidden sm:flex items-center text-xs">
            {filtered.length} κρατήσεις
          </Badge>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Δεν βρέθηκαν κρατήσεις</div>
      ) : isMobile ? (
        /* Mobile: Cards */
        <div className="space-y-3">
          {filtered.map((b) => {
            const totalPrice = Number(b.total_price) || 0;
            const deposit = Number(b.deposit_amount) || 0;
            const remaining = totalPrice - deposit;
            const days = differenceInDays(parseISO(b.check_out), parseISO(b.check_in));

            return (
              <div key={b.id} className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-md p-4 space-y-3 shadow-sm transition-all active:scale-[0.99] duration-150">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{b.customer_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {vehicleMap[b.vehicle_id]?.name}
                      {(b.plate || vehicleMap[b.vehicle_id]?.plate) && (
                        <span className="ml-1 font-semibold text-foreground/70">
                          · {b.plate || vehicleMap[b.vehicle_id]?.plate}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0.5", STATUS_VARIANT[b.status])}>{STATUS_LABELS[b.status]}</Badge>
                </div>
                <div className="text-xs text-foreground font-medium">
                  {format(parseISO(b.check_in), "dd MMM", { locale: el })} → {format(parseISO(b.check_out), "dd MMM yyyy", { locale: el })}
                  <span className="text-muted-foreground font-normal ml-1">({days} ημ.)</span>
                </div>
                {/* Price info */}
                {totalPrice > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{totalPrice}€</span>
                    {deposit > 0 && <span className="text-muted-foreground text-[10px]">(Προκ. {deposit}€)</span>}
                    {remaining > 0 && (
                      <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/30 ml-auto">
                        Υπόλ. {remaining}€
                      </Badge>
                    )}
                    {remaining <= 0 && totalPrice > 0 && (
                      <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30 ml-auto">
                        Εξοφλ. ✓
                      </Badge>
                    )}
                  </div>
                )}
                {b.customer_phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" />{b.customer_phone}</div>}
                {b.customer_email && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" />{b.customer_email}</div>}
                {(b as any).delivery_location && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{(b as any).delivery_location}</div>}
                {b.comments && <div className="flex items-start gap-1.5 text-xs text-muted-foreground"><MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />{b.comments}</div>}
                {b.payment_notes && <div className="flex items-start gap-1.5 text-xs text-muted-foreground"><CreditCard className="h-3.5 w-3.5 shrink-0 mt-0.5" />{b.payment_notes}</div>}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setPreviewTarget(b)} className="h-9 w-9 p-0 rounded-xl" title="Προβολή">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEdit(b)} className="flex-1 text-xs h-9 rounded-xl"><Edit2 className="h-3.5 w-3.5 mr-1" />Επεξεργασία</Button>
                  {b.customer_phone && (
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl active:bg-green-500/10 active:scale-[0.92] transition-all" onClick={() => {
                      const v = vehicleMap[b.vehicle_id];
                      if (v) window.open(buildWhatsAppUrl({ customerName: b.customer_name, customerPhone: b.customer_phone!, vehicleName: v.name, checkIn: b.check_in, checkOut: b.check_out, deliveryLocation: b.delivery_location || undefined, totalPrice: b.total_price || undefined }), "_blank");
                    }}>
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(b)} className="h-9 w-9 p-0 rounded-xl active:scale-[0.92] transition-all"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop: Table */
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Πελάτης</th>
                <th className="px-3 py-2 text-left font-medium">Όχημα</th>
                <th className="px-3 py-2 text-left font-medium">Check-in</th>
                <th className="px-3 py-2 text-left font-medium">Check-out</th>
                <th className="px-3 py-2 text-left font-medium">Κατάσταση</th>
                <th className="px-3 py-2 text-right font-medium">Ποσό</th>
                <th className="px-3 py-2 text-left font-medium">Σχόλια</th>
                <th className="px-3 py-2 text-right font-medium">Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const totalPrice = Number(b.total_price) || 0;
                const deposit = Number(b.deposit_amount) || 0;
                const remaining = totalPrice - deposit;

                return (
                  <tr key={b.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-medium">{b.customer_name}</div>
                      {b.customer_phone && <div className="text-xs text-muted-foreground">{b.customer_phone}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div>{vehicleMap[b.vehicle_id]?.name}</div>
                      {(b.plate || vehicleMap[b.vehicle_id]?.plate) && (
                        <div className="text-xs text-muted-foreground font-medium">
                          {b.plate || vehicleMap[b.vehicle_id]?.plate}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{format(parseISO(b.check_in), "dd/MM/yy")}</td>
                    <td className="px-3 py-2">{format(parseISO(b.check_out), "dd/MM/yy")}</td>
                    <td className="px-3 py-2"><Badge className={cn("text-xs", STATUS_VARIANT[b.status])}>{STATUS_LABELS[b.status]}</Badge></td>
                    <td className="px-3 py-2 text-right">
                      {totalPrice > 0 ? (
                        <div>
                          <div className="font-medium">{totalPrice}€</div>
                          {remaining > 0 && <div className="text-[10px] text-warning">Υπόλ. {remaining}€</div>}
                          {remaining <= 0 && totalPrice > 0 && <div className="text-[10px] text-success">Εξοφλ. ✓</div>}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[150px] truncate">{b.comments || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setPreviewTarget(b)} title="Προβολή"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(b)} title="Επεξεργασία"><Edit2 className="h-4 w-4" /></Button>
                        {b.customer_phone && (
                          <Button variant="ghost" size="icon" title="WhatsApp" onClick={() => {
                            const v = vehicleMap[b.vehicle_id];
                            if (v) window.open(buildWhatsAppUrl({ customerName: b.customer_name, customerPhone: b.customer_phone!, vehicleName: v.name, checkIn: b.check_in, checkOut: b.check_out, deliveryLocation: b.delivery_location || undefined, totalPrice: b.total_price || undefined }), "_blank");
                          }}>
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(b)} title="Διαγραφή"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Sheet */}
      <BookingPreviewSheet
        open={!!previewTarget}
        onOpenChange={(open) => !open && setPreviewTarget(null)}
        booking={previewTarget}
        vehicle={previewTarget ? vehicleMap[previewTarget.vehicle_id] : undefined}
        onEdit={() => { if (previewTarget) { setPreviewTarget(null); onEdit(previewTarget); } }}
      />

      {/* Delete Confirmation */}
      <ConfirmSheet
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Διαγραφή κράτησης"
        description={`Είστε σίγουροι ότι θέλετε να διαγράψετε την κράτηση του ${deleteTarget?.customer_name ?? ""}${
          deleteTarget && vehicleMap[deleteTarget.vehicle_id] ? ` (${vehicleMap[deleteTarget.vehicle_id].name})` : ""
        }; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
