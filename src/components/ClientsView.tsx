import { useMemo, useState } from "react";
import { Search, Phone, Mail, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";

interface ClientsViewProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onBookingClick: (booking: Booking) => void;
}

interface Client {
  name: string;
  phone: string | null;
  email: string | null;
  bookings: Booking[];
}

export function ClientsView({ bookings, vehicles, onBookingClick }: ClientsViewProps) {
  const [search, setSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const clients = useMemo(() => {
    const map = new Map<string, Client>();
    for (const b of bookings) {
      const key = b.customer_name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          name: b.customer_name,
          phone: b.customer_phone,
          email: b.customer_email,
          bookings: [],
        });
      }
      const client = map.get(key)!;
      client.bookings.push(b);
      if (!client.phone && b.customer_phone) client.phone = b.customer_phone;
      if (!client.email && b.customer_email) client.email = b.customer_email;
    }
    return Array.from(map.values()).sort((a, b) => b.bookings.length - a.bookings.length);
  }, [bookings]);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Αναζήτηση πελάτη..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} πελάτες · {bookings.length} κρατήσεις
      </p>

      <div className="space-y-2">
        {filtered.map((client) => {
          const isExpanded = expandedClient === client.name;
          return (
            <Card key={client.name} className="overflow-hidden">
              <button
                onClick={() => setExpandedClient(isExpanded ? null : client.name)}
                className="w-full text-left"
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{client.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {client.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {client.bookings.length} κρατ.
                  </Badge>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                      isExpanded && "rotate-90"
                    )}
                  />
                </CardContent>
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/30 px-3 py-2 space-y-1.5">
                  {client.bookings
                    .sort((a, b) => b.check_in.localeCompare(a.check_in))
                    .map((b) => (
                      <div
                        key={b.id}
                        onClick={() => onBookingClick(b)}
                        className="flex items-center justify-between p-2 rounded-md bg-background cursor-pointer hover:bg-muted transition-colors text-sm"
                      >
                        <div>
                          <div className="font-medium text-xs">
                            {vehicleMap[b.vehicle_id]?.name ?? "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {b.check_in} → {b.check_out}
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            b.status === "confirmed" && "bg-success/15 text-success border-success/30",
                            b.status === "pending" && "bg-warning/15 text-warning border-warning/30",
                            b.status === "cancelled" && "bg-destructive/15 text-destructive border-destructive/30"
                          )}
                        >
                          {b.status === "confirmed" ? "✓" : b.status === "pending" ? "⏳" : "✗"}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Δεν βρέθηκαν πελάτες
          </div>
        )}
      </div>
    </div>
  );
}
