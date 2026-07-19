import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { useClients } from "@/hooks/useClients";
import { CalendarDays, Car, Search, Users, Wallet, LayoutDashboard, BarChart3 } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: bookings = [] } = useBookings();
  const { data: vehicles = [] } = useVehicles();
  const { data: clients = [] } = useClients();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Αναζήτηση κρατήσεων, πελατών, οχημάτων…" />
      <CommandList>
        <CommandEmpty>Δεν βρέθηκαν αποτελέσματα.</CommandEmpty>
        <CommandGroup heading="Πλοήγηση">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Σήμερα
          </CommandItem>
          <CommandItem onSelect={() => go("/bookings")}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Κρατήσεις
          </CommandItem>
          <CommandItem onSelect={() => go("/clients")}>
            <Users className="mr-2 h-4 w-4" />
            Πελάτες
          </CommandItem>
          <CommandItem onSelect={() => go("/fleet")}>
            <Car className="mr-2 h-4 w-4" />
            Στόλος
          </CommandItem>
          <CommandItem onSelect={() => go("/money")}>
            <Wallet className="mr-2 h-4 w-4" />
            Οικονομικά
          </CommandItem>
          <CommandItem onSelect={() => go("/insights")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Στατιστικά
          </CommandItem>
          <CommandItem onSelect={() => go("/booking/new")}>
            <Search className="mr-2 h-4 w-4" />
            Νέα κράτηση
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Πελάτες">
          {clients.slice(0, 8).map((c) => (
            <CommandItem key={c.id} onSelect={() => go(`/clients/${c.id}`)} value={`client-${c.name}-${c.phone ?? ""}`}>
              <Users className="mr-2 h-4 w-4" />
              <span className="truncate">{c.name}</span>
              {c.phone && <span className="ml-auto text-xs text-muted-foreground">{c.phone}</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Κρατήσεις">
          {bookings
            .filter((b) => b.status !== "cancelled")
            .slice(0, 10)
            .map((b) => (
              <CommandItem
                key={b.id}
                onSelect={() => go(`/booking/${b.id}`)}
                value={`booking-${b.customer_name}-${b.customer_phone ?? ""}-${vehicleMap[b.vehicle_id]?.name ?? ""}`}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                <span className="truncate">{b.customer_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(parseISO(b.check_in), "dd/MM")} · {vehicleMap[b.vehicle_id]?.name}
                </span>
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandGroup heading="Οχήματα">
          {vehicles.map((v) => (
            <CommandItem key={v.id} onSelect={() => go(`/fleet?vehicle=${v.id}`)} value={`vehicle-${v.name}`}>
              <Car className="mr-2 h-4 w-4" />
              {v.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {v.type === "car" ? "Αυτοκίνητο" : "Scooter"}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
