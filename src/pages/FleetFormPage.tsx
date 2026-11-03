import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bike, Car, Check, ImageIcon, Layers, Minus, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useVehicles } from "@/hooks/useVehicles";
import { useCreateVehicle } from "@/hooks/useCreateVehicle";
import { useUpdateVehicle } from "@/hooks/useUpdateVehicle";
import { parsePlates } from "@/components/fleet/fleetData";
import { ModelPhoto, PlateChip } from "@/components/fleet/FleetModelCard";

function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-10 w-10 rounded-full"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Λιγότερες"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
        className="h-10 w-16 border-0 text-center text-lg font-bold tabular-nums shadow-none focus-visible:ring-1"
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-10 w-10 rounded-full"
        onClick={() => onChange(value + 1)}
        aria-label="Περισσότερες"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {step}
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function PlateInputs({
  count,
  offset = 0,
  values,
  onChange,
}: {
  count: number;
  offset?: number;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border bg-background p-1.5 pl-3 focus-within:ring-2 focus-within:ring-ring">
          <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">Μονάδα {offset + i + 1}</span>
          <Input
            value={values[i] ?? ""}
            placeholder="π.χ. ΑΜΗ1234"
            className="h-9 border-0 bg-transparent font-mono uppercase shadow-none focus-visible:ring-0"
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function FleetFormPage() {
  const navigate = useNavigate();
  const { data: vehicles = [] } = useVehicles();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();

  const [mode, setMode] = useState<"existing" | "new">("existing");

  // Existing-fleet mode: add units to a type we already have
  const [existingId, setExistingId] = useState("");
  const [addCount, setAddCount] = useState<number>(1);
  const [addPlates, setAddPlates] = useState<string[]>([""]);

  // New-type mode
  const [name, setName] = useState("");
  const [type, setType] = useState<"car" | "scooter">("car");
  const [cc, setCc] = useState("");
  const [rateLow, setRateLow] = useState("");
  const [rateHigh, setRateHigh] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [plates, setPlates] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const existingVehicle = vehicles.find((v) => v.id === existingId);
  const existingPlates = useMemo(() => (existingVehicle ? parsePlates(existingVehicle) : []), [existingVehicle]);

  const effectiveMode = vehicles.length === 0 ? "new" : mode;

  const resizeAdd = (next: number) => {
    setAddCount(next);
    setAddPlates((prev) => Array.from({ length: next }, (_, i) => prev[i] ?? ""));
  };
  const resizeNew = (next: number) => {
    setQuantity(next);
    setPlates((prev) => Array.from({ length: next }, (_, i) => prev[i] ?? ""));
  };

  const submitExisting = async () => {
    if (!existingVehicle) {
      toast.error("Επιλέξτε όχημα από τον στόλο");
      return;
    }
    try {
      const newOnes = addPlates.map((p) => p.trim()).filter(Boolean);
      const merged = [...existingPlates, ...newOnes];
      await updateVehicle.mutateAsync({
        id: existingVehicle.id,
        quantity: (existingVehicle.quantity ?? 1) + addCount,
        plate: merged.join(", ") || null,
      });
      toast.success(`Προστέθηκαν ${addCount} μονάδες στο ${existingVehicle.name}`);
      navigate(`/fleet?vehicle=${existingVehicle.id}`);
    } catch {
      toast.error("Σφάλμα προσθήκης μονάδων");
    }
  };

  const submitNew = async () => {
    const ccNum = parseInt(cc);
    const low = parseFloat(rateLow);
    const high = parseFloat(rateHigh);
    if (!name.trim() || !ccNum || isNaN(low) || isNaN(high)) {
      toast.error("Συμπληρώστε όνομα, cc και τιμές");
      return;
    }
    try {
      const nonEmpty = plates.map((p) => p.trim()).filter(Boolean);
      const created = await createVehicle.mutateAsync({
        name: name.trim(),
        type,
        cc: ccNum,
        daily_rate_low: low,
        daily_rate_high: high,
        quantity,
        plate: nonEmpty.join(", ") || null,
        notes: notes.trim() || null,
        image_url: imageUrl.trim() || null,
      });
      toast.success("Το όχημα προστέθηκε στον στόλο");
      navigate(created?.id ? `/fleet?vehicle=${created.id}` : "/fleet");
    } catch {
      toast.error("Σφάλμα προσθήκης οχήματος");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveMode === "existing") await submitExisting();
    else await submitNew();
  };

  const pending = createVehicle.isPending || updateVehicle.isPending;
  const newPlates = (effectiveMode === "existing" ? addPlates : plates).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 md:py-8 lg:px-10">
      <div className="mb-6 flex items-center gap-3 md:mb-8">
        <Button variant="outline" size="icon" onClick={() => navigate("/fleet")} className="h-10 w-10 shrink-0 rounded-full" aria-label="Πίσω">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.025em] md:text-[36px]">Προσθήκη οχήματος</h1>
          <p className="text-sm text-muted-foreground">Από υπάρχοντα στόλο ή νέος τύπος</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0 space-y-6">
          {vehicles.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { key: "existing", label: "Από υπάρχοντα στόλο", hint: "Νέες μονάδες σε μοντέλο που ήδη έχετε", icon: Layers },
                  { key: "new", label: "Νέος τύπος οχήματος", hint: "Νέο μοντέλο με δικές του τιμές", icon: Sparkles },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = effectiveMode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    aria-pressed={active}
                    className={cn(
                      "pressable relative flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all",
                      active ? "border-primary ring-2 ring-primary" : "hover:border-foreground/25",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                    {active && <Check className="absolute right-4 top-4 h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {effectiveMode === "existing" ? (
            <>
              <Section step={1} title="Επιλέξτε μοντέλο" hint="Οι νέες μονάδες παίρνουν τις τιμές και τη σελίδα του μοντέλου.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Όχημα από τον στόλο">
                  {vehicles.map((v) => {
                    const active = v.id === existingId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setExistingId(v.id)}
                        className={cn(
                          "pressable relative flex items-center gap-3 rounded-xl border bg-background p-2 text-left transition-all",
                          active ? "border-primary ring-2 ring-primary" : "hover:border-foreground/25",
                        )}
                      >
                        <ModelPhoto summary={{ vehicle: v }} className="h-14 w-20 shrink-0 rounded-lg" iconClassName="h-6 w-6" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{v.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {v.cc}cc · x{v.quantity ?? 1}
                          </span>
                        </span>
                        {active && (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {existingVehicle && (
                <Section step={2} title="Νέες μονάδες" hint={`Τρέχων στόλος: x${existingVehicle.quantity ?? 1}`}>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm font-medium">Πόσες μονάδες θα προστεθούν</Label>
                    <Stepper value={addCount} onChange={resizeAdd} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Πινακίδες νέων μονάδων</Label>
                    <PlateInputs
                      count={addCount}
                      offset={existingVehicle.quantity ?? 1}
                      values={addPlates}
                      onChange={setAddPlates}
                    />
                  </div>
                </Section>
              )}
            </>
          ) : (
            <>
              <Section step={1} title="Στοιχεία οχήματος">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Όνομα *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Toyota Aygo" className="h-11 text-base" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Τύπος</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: "car", label: "Αυτοκίνητο", icon: Car },
                        { key: "scooter", label: "Scooter", icon: Bike },
                      ] as const
                    ).map((t) => {
                      const Icon = t.icon;
                      const active = type === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setType(t.key)}
                          aria-pressed={active}
                          className={cn(
                            "pressable flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm font-semibold transition-all",
                            active ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon className="h-6 w-6" strokeWidth={1.75} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">cc *</Label>
                    <Input type="number" min={0} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="1000" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Τιμή low (€) *</Label>
                    <Input type="number" min={0} step="0.5" value={rateLow} onChange={(e) => setRateLow(e.target.value)} placeholder="25" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Τιμή high (€) *</Label>
                    <Input type="number" min={0} step="0.5" value={rateHigh} onChange={(e) => setRateHigh(e.target.value)} placeholder="45" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Φωτογραφία (URL, προαιρετικό)</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" inputMode="url" />
                </div>
              </Section>

              <Section step={2} title="Στόλος & Πινακίδες" hint="Πόσα ίδια οχήματα έχετε και οι πινακίδες τους.">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm font-medium">Ποσότητα</Label>
                  <Stepper value={quantity} onChange={resizeNew} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Πινακίδες ανά μονάδα</Label>
                  <PlateInputs count={quantity} values={plates} onChange={setPlates} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Σημειώσεις</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Σημειώσεις για το όχημα..." />
                </div>
              </Section>
            </>
          )}
        </div>

        {/* Live preview + actions */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Προεπισκόπηση</p>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {effectiveMode === "existing" ? (
              existingVehicle ? (
                <ModelPhoto summary={{ vehicle: existingVehicle }} className="aspect-[16/10] w-full" />
              ) : (
                <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  Επιλέξτε μοντέλο
                </div>
              )
            ) : imageUrl.trim() ? (
              <img src={imageUrl.trim()} alt="" className="aspect-[16/10] w-full bg-muted object-cover" />
            ) : (
              <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-secondary text-muted-foreground/60">
                {type === "car" ? <Car className="h-12 w-12" strokeWidth={1.5} /> : <Bike className="h-12 w-12" strokeWidth={1.5} />}
                <span className="inline-flex items-center gap-1 text-xs">
                  <ImageIcon className="h-3 w-3" /> Χωρίς φωτογραφία
                </span>
              </div>
            )}
            <div className="space-y-3 p-4">
              {effectiveMode === "existing" ? (
                <>
                  <div>
                    <h3 className="truncate text-[17px] font-semibold tracking-tight">{existingVehicle?.name ?? "–"}</h3>
                    {existingVehicle && (
                      <p className="text-xs text-muted-foreground">
                        {existingVehicle.cc}cc · {existingVehicle.daily_rate_low}–{existingVehicle.daily_rate_high}€/ημ.
                      </p>
                    )}
                  </div>
                  {existingVehicle && (
                    <div className="flex items-baseline gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
                      <span className="text-sm text-muted-foreground">x{existingVehicle.quantity ?? 1}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-xl font-bold tabular-nums">x{(existingVehicle.quantity ?? 1) + addCount}</span>
                      <span className="text-xs text-muted-foreground">συνολικά μετά την προσθήκη</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {existingPlates.map((p) => (
                      <PlateChip key={p} plate={p} muted />
                    ))}
                    {newPlates.map((p, i) => (
                      <span
                        key={`${p}-${i}`}
                        className="inline-flex h-6 items-center rounded-md border border-success/40 bg-success/10 px-1.5 font-mono text-[11px] font-semibold uppercase text-success"
                      >
                        + {p}
                      </span>
                    ))}
                    {existingVehicle && existingPlates.length === 0 && newPlates.length === 0 && (
                      <span className="text-xs text-muted-foreground">Χωρίς καταχωρημένες πινακίδες</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className={cn("truncate text-[17px] font-semibold tracking-tight", !name.trim() && "text-muted-foreground")}>
                      {name.trim() || "Όνομα μοντέλου"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {type === "car" ? "Αυτοκίνητο" : "Scooter"} · {cc || "–"}cc · {quantity} {quantity === 1 ? "μονάδα" : "μονάδες"}
                    </p>
                  </div>
                  {(rateLow || rateHigh) && (
                    <p className="text-sm">
                      <span className="text-lg font-bold tabular-nums">
                        €{rateLow || "–"}–{rateHigh || "–"}
                      </span>
                      <span className="text-xs text-muted-foreground"> / ημέρα</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {newPlates.length ? newPlates.map((p, i) => <PlateChip key={`${p}-${i}`} plate={p.toUpperCase()} />) : <PlateChip plate={null} />}
                  </div>
                  <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    Μετά την αποθήκευση ορίστε τις τιμές ανά περίοδο από την καρτέλα «Τιμές» του μοντέλου.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold"
              disabled={pending || (effectiveMode === "existing" && !existingVehicle)}
            >
              {effectiveMode === "existing" ? "Προσθήκη μονάδων" : "Προσθήκη στον στόλο"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/fleet")} className="h-11 w-full rounded-xl">
              Ακύρωση
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
