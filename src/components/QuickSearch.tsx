import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Vehicle } from "@/hooks/useVehicles";

interface QuickSearchProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onBookingClick: (booking: Booking) => void;
}

export function QuickSearch({ bookings, vehicles, onBookingClick }: QuickSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v.name])),
    [vehicles]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return bookings
      .filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.customer_phone?.toLowerCase().includes(q) ||
          vehicleMap[b.vehicle_id]?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, bookings, vehicleMap]);

  if (!open) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm md:relative md:inset-auto md:bg-transparent md:backdrop-blur-none">
      <div className="p-4 md:p-0 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3 md:mb-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση πελάτη, τηλεφώνου..."
              className="pl-9"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOpen(false); setQuery(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {results.length > 0 && (
          <div className="mt-2 bg-card border rounded-lg shadow-lg overflow-hidden">
            {results.map((b) => (
              <button
                key={b.id}
                onClick={() => { onBookingClick(b); setOpen(false); setQuery(""); }}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
              >
                <div className="font-medium text-sm">{b.customer_name}</div>
                <div className="text-xs text-muted-foreground">
                  {vehicleMap[b.vehicle_id]} · {b.check_in} → {b.check_out}
                </div>
              </button>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">Δεν βρέθηκαν αποτελέσματα</div>
        )}
      </div>
    </div>
  );
}
