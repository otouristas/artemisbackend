import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { el } from "date-fns/locale";
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Mail,
  Save,
  Merge,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useClient, useClients, useMergeClients, useUpdateClient } from "@/hooks/useClients";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { STATUS_CHIP, STATUS_LABELS, clientInitials } from "@/lib/status";
import { cn } from "@/lib/utils";

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id);
  const { data: allClients = [] } = useClients();
  const { data: bookings = [] } = useBookings();
  const { data: vehicles = [] } = useVehicles();
  const updateClient = useUpdateClient();
  const mergeClients = useMergeClients();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [preferredVehicleId, setPreferredVehicleId] = useState<string>("");
  const [mergeId, setMergeId] = useState("");

  useEffect(() => {
    if (!client) return;
    setName(client.name);
    setPhone(client.phone ?? "");
    setEmail(client.email ?? "");
    setIdDocument(client.id_document ?? "");
    setNotes(client.notes ?? "");
    setTags((client.tags ?? []).join(", "));
    setPreferredVehicleId(client.preferred_vehicle_id ?? "");
  }, [client]);

  const clientBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.client_id === id)
        .sort((a, b) => b.check_in.localeCompare(a.check_in)),
    [bookings, id],
  );

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const ltv = clientBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  const balance = clientBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + Math.max((Number(b.total_price) || 0) - (Number(b.deposit_amount) || 0), 0), 0);

  const duplicates = useMemo(() => {
    if (!client?.phone) return [];
    const phoneKey = client.phone.replace(/\D/g, "");
    return allClients.filter(
      (c) => c.id !== client.id && c.phone && c.phone.replace(/\D/g, "") === phoneKey,
    );
  }, [allClients, client]);

  const save = async () => {
    if (!id) return;
    try {
      await updateClient.mutateAsync({
        id,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        id_document: idDocument.trim() || null,
        notes: notes.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        preferred_vehicle_id: preferredVehicleId || null,
      });
      toast.success("Το προφίλ αποθηκεύτηκε");
    } catch {
      toast.error("Σφάλμα αποθήκευσης");
    }
  };

  const handleMerge = async () => {
    if (!id || !mergeId) return;
    try {
      await mergeClients.mutateAsync({ keepId: id, mergeId });
      toast.success("Οι πελάτες συγχωνεύθηκαν");
      setMergeId("");
    } catch {
      toast.error("Σφάλμα συγχώνευσης");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 text-center">
        <p className="font-display text-xl mb-2">Ο πελάτης δεν βρέθηκε</p>
        <Button variant="outline" onClick={() => navigate("/clients")}>
          Επιστροφή
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate("/clients")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Πελάτες
      </Button>

      <PageHeader
        title={client.name}
        subtitle={`LTV ${ltv}€ · υπόλοιπο ${balance}€ · ${clientBookings.length} κρατήσεις`}
        actions={
          <>
            {client.phone && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${client.phone}`}>
                    <Phone className="h-4 w-4 mr-1" />
                    Κλήση
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => {
                    const last = clientBookings[0];
                    window.open(
                      buildWhatsAppUrl({
                        customerName: client.name,
                        customerPhone: client.phone!,
                        vehicleName: last ? vehicleMap[last.vehicle_id]?.name ?? "όχημα" : "όχημα",
                        checkIn: last?.check_in ?? format(new Date(), "yyyy-MM-dd"),
                        checkOut: last?.check_out ?? format(new Date(), "yyyy-MM-dd"),
                        totalPrice: last ? Number(last.total_price) || undefined : undefined,
                      }),
                      "_blank",
                    );
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  WhatsApp
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => void save()} disabled={updateClient.isPending}>
              <Save className="h-4 w-4 mr-1" />
              Αποθήκευση
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display text-xl">
          {clientInitials(client.name)}
        </div>
        <div className="text-sm text-muted-foreground space-y-0.5">
          {client.phone && (
            <p className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {client.phone}
            </p>
          )}
          {client.email && (
            <p className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {client.email}
            </p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-display text-lg">Στοιχεία</h2>
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
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ταυτότητα / Διαβατήριο</Label>
            <Input value={idDocument} onChange={(e) => setIdDocument(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ετικέτες (κόμμα)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VIP, repeat…" />
          </div>
          <div className="space-y-1.5">
            <Label>Προτιμώμενο όχημα</Label>
            <Select value={preferredVehicleId || "none"} onValueChange={(v) => setPreferredVehicleId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Σημειώσεις</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="font-display text-lg mb-3">Ιστορικό διαμονών</h2>
            {clientBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν κρατήσεις ακόμα.</p>
            ) : (
              <div className="space-y-2">
                {clientBookings.map((b) => (
                  <Link
                    key={b.id}
                    to={`/booking/${b.id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/40 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{vehicleMap[b.vehicle_id]?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(b.check_in), "d MMM", { locale: el })} –{" "}
                        {format(parseISO(b.check_out), "d MMM yyyy", { locale: el })}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_CHIP[b.status])}>
                        {STATUS_LABELS[b.status]}
                      </Badge>
                      <p className="text-xs mt-1 font-medium">{Number(b.total_price) || 0}€</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => navigate(`/booking/new?clientId=${client.id}`)}
            >
              Νέα κράτηση για τον πελάτη
            </Button>
          </div>

          {duplicates.length > 0 && (
            <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
              <h2 className="font-display text-lg mb-2 flex items-center gap-2">
                <Merge className="h-4 w-4" />
                Πιθανά διπλότυπα
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Βρέθηκαν πελάτες με το ίδιο τηλέφωνο. Συγχωνεύστε σε αυτό το προφίλ.
              </p>
              <Select value={mergeId || "none"} onValueChange={(v) => setMergeId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Επιλογή διπλότυπου" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {duplicates.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.email ? `· ${d.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="mt-3 w-full"
                disabled={!mergeId || mergeClients.isPending}
                onClick={() => void handleMerge()}
              >
                Συγχώνευση
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
