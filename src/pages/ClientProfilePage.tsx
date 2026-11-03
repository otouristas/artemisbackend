import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  Euro,
  Mail,
  MessageCircle,
  Phone,
  Repeat,
  Save,
  StickyNote,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useClient, useClients, useUpdateClient } from "@/hooks/useClients";
import { useBookings } from "@/hooks/useBookings";
import { useVehicles, type Vehicle } from "@/hooks/useVehicles";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { LanguageChip, TagChips } from "@/components/clients/ClientPills";
import { BookingHistory } from "@/components/clients/BookingHistory";
import { ClientTimeline } from "@/components/clients/ClientTimeline";
import { MergeDuplicatesCard } from "@/components/clients/MergeDuplicatesCard";
import { TagEditor } from "@/components/clients/TagEditor";
import {
  LANGUAGE_LABELS,
  bookingBalance,
  computeStats,
  copyText,
  formatDay,
  formatEuro,
  normalizeLanguage,
  phoneKey,
  todayKey,
} from "@/components/clients/clientUtils";

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: string;
  hint?: string;
  tone?: "warning" | "success";
}) {
  return (
    <div className="min-w-0 bg-card px-4 py-3.5 md:px-5 md:py-4">
      <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          "mt-1 truncate text-xl font-semibold tabular-nums tracking-tight md:text-2xl",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SideCard({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3 md:px-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h2>
        {action}
      </header>
      <div className="px-4 py-4 md:px-5">{children}</div>
    </section>
  );
}

function ActionTile({
  icon,
  label,
  href,
  onClick,
  external,
  tone,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  tone?: "success" | "primary";
  disabled?: boolean;
}) {
  const cls = cn(
    "pressable flex flex-col items-center justify-center gap-1 rounded-xl border bg-card py-2.5 text-[11px] font-semibold text-foreground active:bg-muted",
    tone === "success" && "border-success/30 bg-success/10 text-success",
    tone === "primary" && "border-primary bg-primary text-primary-foreground active:bg-primary/90",
    disabled && "pointer-events-none opacity-40",
  );
  if (href && !disabled) {
    return (
      <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {icon}
      {label}
    </button>
  );
}

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id);
  const { data: allClients = [] } = useClients();
  const { data: bookings = [] } = useBookings();
  const { data: vehicles = [] } = useVehicles();
  const updateClient = useUpdateClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  const [preferredVehicleId, setPreferredVehicleId] = useState<string>("");
  // Which client version the form was last filled from — avoids a "dirty" flash before the first fill.
  const [formFor, setFormFor] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    if (!client) return;
    setName(client.name);
    setPhone(client.phone ?? "");
    setEmail(client.email ?? "");
    setIdDocument(client.id_document ?? "");
    setNotes(client.notes ?? "");
    setTags(client.tags ?? []);
    setLanguage(client.preferred_language ?? "");
    setPreferredVehicleId(client.preferred_vehicle_id ?? "");
    setFormFor(`${client.id}:${client.updated_at}`);
  }, [client]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const clientBookings = useMemo(
    () => bookings.filter((b) => b.client_id === id).sort((a, b) => b.check_in.localeCompare(a.check_in)),
    [bookings, id],
  );

  const vehicleMap = useMemo<Record<string, Vehicle | undefined>>(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const stats = useMemo(() => computeStats(clientBookings), [clientBookings]);

  const current = useMemo(() => {
    const today = todayKey();
    return (
      clientBookings
        .filter((b) => b.status !== "cancelled" && b.check_out >= today)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))[0] ?? null
    );
  }, [clientBookings]);

  const duplicates = useMemo(() => {
    if (!client?.phone) return [];
    const key = phoneKey(client.phone);
    if (key.length < 6) return [];
    return allClients.filter((c) => c.id !== client.id && c.phone && phoneKey(c.phone) === key);
  }, [allClients, client]);

  const dirty = useMemo(() => {
    if (!client || formFor !== `${client.id}:${client.updated_at}`) return false;
    return (
      name !== client.name ||
      phone !== (client.phone ?? "") ||
      email !== (client.email ?? "") ||
      idDocument !== (client.id_document ?? "") ||
      notes !== (client.notes ?? "") ||
      language !== (client.preferred_language ?? "") ||
      preferredVehicleId !== (client.preferred_vehicle_id ?? "") ||
      tags.join("\u0000") !== (client.tags ?? []).join("\u0000")
    );
  }, [client, formFor, name, phone, email, idDocument, notes, language, preferredVehicleId, tags]);

  const save = useCallback(async () => {
    if (!id) return;
    if (!name.trim()) {
      toast.error("Το όνομα είναι υποχρεωτικό");
      return;
    }
    try {
      await updateClient.mutateAsync({
        id,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        id_document: idDocument.trim() || null,
        notes: notes.trim() || null,
        tags: tags.map((t) => t.trim()).filter(Boolean),
        preferred_language: language || null,
        preferred_vehicle_id: preferredVehicleId || null,
      });
      toast.success("Το προφίλ αποθηκεύτηκε");
    } catch {
      toast.error("Σφάλμα αποθήκευσης");
    }
  }, [id, name, phone, email, idDocument, notes, tags, language, preferredVehicleId, updateClient]);

  // ⌘S / Ctrl+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  const openWhatsApp = () => {
    if (!client?.phone) return;
    const last = clientBookings[0];
    window.open(
      buildWhatsAppUrl({
        customerName: client.name,
        customerPhone: client.phone,
        vehicleName: last ? vehicleMap[last.vehicle_id]?.name ?? "όχημα" : "όχημα",
        checkIn: last?.check_in ?? format(new Date(), "yyyy-MM-dd"),
        checkOut: last?.check_out ?? format(new Date(), "yyyy-MM-dd"),
        totalPrice: last ? Number(last.total_price) || undefined : undefined,
      }),
      "_blank",
    );
  };

  const newBooking = () => client && navigate(`/booking/new?clientId=${client.id}`);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-6 md:px-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mb-4 font-display text-xl font-semibold">Ο πελάτης δεν βρέθηκε</p>
        <Button variant="outline" onClick={() => navigate("/clients")}>
          Επιστροφή
        </Button>
      </div>
    );
  }

  const avgPerDay = stats.rentalDays ? stats.ltv / stats.rentalDays : 0;
  const currentVehicle = current ? vehicleMap[current.vehicle_id] : undefined;
  const currentInProgress = current ? current.check_in <= todayKey() : false;
  const daysUntil = current ? differenceInCalendarDays(parseISO(current.check_in), new Date()) : 0;
  const languageOptions = Object.entries(LANGUAGE_LABELS);
  const normalizedLang = normalizeLanguage(language);
  const langInList = !language || languageOptions.some(([c]) => c === language);

  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 py-4 md:px-8 md:py-8", dirty && "pb-36 md:pb-28")}>
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground md:mb-4">
        <Link to="/clients" className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 -ml-1 hover:text-foreground">
          <Users className="h-3.5 w-3.5" />
          Πελάτες
        </Link>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="truncate font-medium text-foreground">{client.name}</span>
      </nav>

      {/* Header card */}
      <section className="mb-5 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-5 p-4 md:flex-row md:items-start md:justify-between md:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <ClientAvatar name={client.name} size="lg" />
            <div className="min-w-0 pt-0.5">
              <h1 className="break-words font-display text-[24px] font-bold leading-7 tracking-[-0.02em] md:truncate md:text-[32px] md:leading-10">
                {client.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Πελάτης από {formatDay(client.created_at, "MMM yyyy")}
                </span>
                {client.preferred_language && <LanguageChip code={client.preferred_language} />}
                {stats.count >= 2 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-medium text-accent">
                    <Repeat className="h-3 w-3" />
                    Επαναλαμβανόμενος
                  </span>
                )}
                {(client.tags?.length ?? 0) > 0 && <TagChips tags={client.tags} max={4} />}
              </div>
              <div className="mt-3 flex flex-col gap-1.5 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
                {client.phone && (
                  <button
                    type="button"
                    onClick={() => void copyText(client.phone!, "Το τηλέφωνο αντιγράφηκε")}
                    className="group inline-flex items-center gap-2 self-start rounded text-foreground hover:text-primary"
                  >
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="tabular-nums">{client.phone}</span>
                    <Copy className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 coarse:opacity-60" />
                  </button>
                )}
                {client.email && (
                  <button
                    type="button"
                    onClick={() => void copyText(client.email!, "Το email αντιγράφηκε")}
                    className="group inline-flex min-w-0 max-w-full items-center gap-2 self-start rounded text-foreground hover:text-primary"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{client.email}</span>
                    <Copy className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 coarse:opacity-60" />
                  </button>
                )}
                {!client.phone && !client.email && (
                  <span className="text-muted-foreground">Χωρίς στοιχεία επικοινωνίας</span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {client.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${client.phone}`}>
                  <Phone className="mr-1.5 h-4 w-4" />
                  Κλήση
                </a>
              </Button>
            )}
            {client.email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${client.email}`}>
                  <Mail className="mr-1.5 h-4 w-4" />
                  Email
                </a>
              </Button>
            )}
            {client.phone && (
              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={openWhatsApp}>
                <MessageCircle className="mr-1.5 h-4 w-4" />
                WhatsApp
              </Button>
            )}
            <Button size="sm" onClick={newBooking}>
              <CalendarPlus className="mr-1.5 h-4 w-4" />
              Νέα κράτηση
            </Button>
          </div>

          {/* Mobile action tiles */}
          <div className="grid grid-cols-4 gap-2 md:hidden">
            <ActionTile icon={<Phone className="h-[18px] w-[18px]" />} label="Κλήση" href={client.phone ? `tel:${client.phone}` : undefined} disabled={!client.phone} />
            <ActionTile
              icon={<MessageCircle className="h-[18px] w-[18px]" />}
              label="WhatsApp"
              onClick={openWhatsApp}
              tone="success"
              disabled={!client.phone}
            />
            <ActionTile icon={<Mail className="h-[18px] w-[18px]" />} label="Email" href={client.email ? `mailto:${client.email}` : undefined} disabled={!client.email} />
            <ActionTile icon={<CalendarPlus className="h-[18px] w-[18px]" />} label="Κράτηση" onClick={newBooking} tone="primary" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-px border-t bg-border md:grid-cols-4">
          <Stat
            icon={<Euro className="h-3.5 w-3.5" />}
            label="Συνολική αξία"
            value={formatEuro(stats.ltv)}
            hint={stats.count ? `Μ.Ο. ${formatEuro(stats.ltv / stats.count)} / κράτηση` : "Καμία κράτηση ακόμα"}
          />
          <Stat
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Κρατήσεις"
            value={String(stats.count)}
            hint={
              stats.cancelled
                ? `+${stats.cancelled} ακυρωμένες`
                : stats.firstRental
                  ? `Πρώτη: ${formatDay(stats.firstRental, "MMM yyyy")}`
                  : "—"
            }
          />
          <Stat
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            label={
              <>
                <span className="sm:hidden">Υπόλοιπο</span>
                <span className="hidden sm:inline">Ανοιχτό υπόλοιπο</span>
              </>
            }
            value={formatEuro(stats.balance)}
            hint={stats.balance > 0 ? "Προς είσπραξη" : stats.count ? "Εξοφλημένο" : "—"}
            tone={stats.balance > 0 ? "warning" : stats.count ? "success" : undefined}
          />
          <Stat
            icon={<Clock className="h-3.5 w-3.5" />}
            label={
              <>
                <span className="sm:hidden">Ημέρες</span>
                <span className="hidden sm:inline">Ημέρες ενοικίασης</span>
              </>
            }
            value={String(stats.rentalDays)}
            hint={avgPerDay ? `${formatEuro(avgPerDay)} / ημέρα` : "—"}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          {current && (
            <Link
              to={`/booking/${current.id}`}
              className="group flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5 transition-colors hover:bg-primary/10 md:px-5"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
                  {currentInProgress
                    ? "Σε ενοικίαση τώρα"
                    : daysUntil <= 0
                      ? "Παραλαβή σήμερα"
                      : daysUntil === 1
                        ? "Επόμενη ενοικίαση · αύριο"
                        : `Επόμενη ενοικίαση · σε ${daysUntil} ημέρες`}
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {currentVehicle?.name ?? "Όχημα"} · {formatDay(current.check_in, "d MMM")} – {formatDay(current.check_out, "d MMM")}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm font-semibold tabular-nums">{formatEuro(Number(current.total_price) || 0)}</p>
                {bookingBalance(current) > 0 && (
                  <p className="text-xs font-medium tabular-nums text-warning">υπόλ. {formatEuro(bookingBalance(current))}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          <MergeDuplicatesCard keepId={client.id} keepName={client.name} duplicates={duplicates} />

          <BookingHistory bookings={clientBookings} vehicleMap={vehicleMap} onNewBooking={newBooking} />

          <ClientTimeline client={client} bookings={clientBookings} vehicleMap={vehicleMap} />
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-5">
          <SideCard
            icon={<UserRound className="h-4 w-4" />}
            title="Στοιχεία"
            action={
              <Button size="sm" variant={dirty ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => void save()} disabled={!dirty || updateClient.isPending}>
                <Save className="h-3.5 w-3.5" />
                Αποθήκευση
              </Button>
            }
          >
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="cp-name">Όνομα</Label>
                <Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-phone">Τηλέφωνο</Label>
                  <Input id="cp-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-email">Email</Label>
                  <Input id="cp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-id">Ταυτότητα / Διαβατήριο</Label>
                <Input id="cp-id" className="font-mono" value={idDocument} onChange={(e) => setIdDocument(e.target.value)} />
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Γλώσσα</Label>
                  <Select value={language || "none"} onValueChange={(v) => setLanguage(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {!langInList && (
                        <SelectItem value={language}>{normalizedLang?.toUpperCase() ?? language}</SelectItem>
                      )}
                      {languageOptions.map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Προτιμώμενο όχημα</Label>
                  <Select
                    value={preferredVehicleId || "none"}
                    onValueChange={(v) => setPreferredVehicleId(v === "none" ? "" : v)}
                  >
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
              </div>
            </div>
          </SideCard>

          <SideCard icon={<Tag className="h-4 w-4" />} title="Ετικέτες">
            <TagEditor value={tags} onChange={setTags} />
          </SideCard>

          <SideCard icon={<StickyNote className="h-4 w-4" />} title="Σημειώσεις">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Προτιμήσεις, ώρα άφιξης πλοίου, ειδικές οδηγίες…"
              className="resize-y bg-background"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">Ορατές μόνο στην ομάδα.</p>
          </SideCard>
        </aside>
      </div>

      {/* Contextual save bar */}
      <div
        className={cn(
          "fixed inset-x-3 z-50 transition-all duration-200 md:inset-x-auto md:left-[calc(50%+44px)] md:w-[min(560px,calc(100%-120px))] md:-translate-x-1/2",
          "bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6",
          dirty ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <div className="flex items-center gap-3 rounded-xl bg-primary px-4 py-2.5 text-primary-foreground shadow-[0_12px_32px_-8px_hsl(var(--foreground)/0.45)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">Μη αποθηκευμένες αλλαγές</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={resetForm}
            tabIndex={dirty ? 0 : -1}
          >
            Απόρριψη
          </Button>
          <Button
            size="sm"
            className="h-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            onClick={() => void save()}
            disabled={updateClient.isPending}
            tabIndex={dirty ? 0 : -1}
          >
            Αποθήκευση
          </Button>
        </div>
      </div>
    </div>
  );
}
