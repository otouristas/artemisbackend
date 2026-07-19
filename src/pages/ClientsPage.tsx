import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Search, Plus, Phone, Mail, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { useBookings } from "@/hooks/useBookings";
import { clientInitials } from "@/lib/status";

export default function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useClients();
  const { data: bookings = [] } = useBookings();
  const createClient = useCreateClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const statsByClient = useMemo(() => {
    const map = new Map<string, { ltv: number; balance: number; lastStay: string | null; count: number }>();
    for (const b of bookings) {
      if (!b.client_id || b.status === "cancelled") continue;
      const cur = map.get(b.client_id) ?? { ltv: 0, balance: 0, lastStay: null, count: 0 };
      const total = Number(b.total_price) || 0;
      const deposit = Number(b.deposit_amount) || 0;
      cur.ltv += total;
      cur.balance += Math.max(total - deposit, 0);
      cur.count += 1;
      if (!cur.lastStay || b.check_out > cur.lastStay) cur.lastStay = b.check_out;
      map.set(b.client_id, cur);
    }
    return map;
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (statsByClient.get(b.id)?.ltv ?? 0) - (statsByClient.get(a.id)?.ltv ?? 0));
  }, [clients, search, statsByClient]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await createClient.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
      toast.success("Ο πελάτης δημιουργήθηκε");
      setOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      navigate(`/clients/${created.id}`);
    } catch {
      toast.error("Σφάλμα δημιουργίας πελάτη");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageHeader
        title="Πελάτες"
        subtitle={`${clients.length} στο CRM`}
        actions={
          <Button className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Νέος πελάτης
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Αναζήτηση ονόματος, τηλεφώνου, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <p className="font-display text-xl mb-2">Δεν υπάρχουν πελάτες ακόμα</p>
          <p className="text-sm text-muted-foreground mb-4">
            Δημιουργήστε προφίλ ή προσθέστε κράτηση για αυτόματη σύνδεση.
          </p>
          <Button onClick={() => setOpen(true)}>Νέος πελάτης</Button>
        </div>
      ) : (
        <div className="inset-group border md:rounded-xl">
          {filtered.map((client) => {
            const stats = statsByClient.get(client.id);
            return (
              <button
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="pressable w-full text-left flex items-center gap-3 px-4 py-3.5 min-h-[64px] hover:bg-muted/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  {clientInitials(client.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    {client.tags?.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {client.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </span>
                    )}
                    {client.email && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{stats?.ltv ? `${stats.ltv}€` : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {stats?.count ?? 0} κρατ.
                    {stats?.lastStay ? ` · ${format(parseISO(stats.lastStay), "MM/yy")}` : ""}
                  </p>
                  {(stats?.balance ?? 0) > 0 && (
                    <p className="text-[11px] text-accent font-medium">υπόλ. {stats!.balance}€</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 md:hidden" />
              </button>
            );
          })}
        </div>
      )}

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display">Νέος πελάτης</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Όνομα</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Τηλέφωνο</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button
              onClick={() => void handleCreate()}
              disabled={!name.trim() || createClient.isPending}
              className="coarse:h-12 coarse:rounded-xl coarse:text-base"
            >
              Αποθήκευση
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="coarse:h-12 coarse:rounded-xl coarse:text-base"
            >
              Ακύρωση
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
