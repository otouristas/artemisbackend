import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bike, Car, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useVehicles } from "@/hooks/useVehicles";
import { useCreateVehicle } from "@/hooks/useCreateVehicle";
import { useUpdateVehicle } from "@/hooks/useUpdateVehicle";

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

  const existingVehicle = vehicles.find((v) => v.id === existingId);
  const existingPlates = useMemo(
    () => (existingVehicle?.plate ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [existingVehicle],
  );

  const effectiveMode = vehicles.length === 0 ? "new" : mode;

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
      navigate("/fleet");
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
      await createVehicle.mutateAsync({
        name: name.trim(),
        type,
        cc: ccNum,
        daily_rate_low: low,
        daily_rate_high: high,
        quantity,
        plate: nonEmpty.join(", ") || null,
        notes: notes.trim() || null,
      });
      toast.success("Το όχημα προστέθηκε στον στόλο");
      navigate("/fleet");
    } catch {
      toast.error("Σφάλμα προσθήκης οχήματος");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveMode === "existing") await submitExisting();
    else await submitNew();
  };

  return (
    <div className="min-h-screen bg-background pb-12 page-enter">
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-5 md:py-6 flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/fleet")}
            className="h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-xl md:text-2xl tracking-tight text-foreground">
              Προσθήκη οχήματος
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Από υπάρχοντα στόλο ή νέος τύπος
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {vehicles.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "existing", label: "Από υπάρχοντα στόλο", icon: Layers },
                { key: "new", label: "Νέος τύπος οχήματος", icon: Plus },
              ] as const).map((m) => {
                const Icon = m.icon;
                const active = effectiveMode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-all active:scale-[0.97]",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}

          {effectiveMode === "existing" ? (
            <div className="bg-card/70 border border-border/80 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
              <h2 className="font-display text-lg">Προσθήκη μονάδων σε υπάρχον όχημα</h2>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Όχημα από τον στόλο *</Label>
                <Select value={existingId} onValueChange={setExistingId}>
                  <SelectTrigger><SelectValue placeholder="Επιλέξτε όχημα" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.cc}cc) · x{v.quantity ?? 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {existingVehicle && (
                <>
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
                    <p className="text-muted-foreground">
                      Τρέχων στόλος: <strong className="text-foreground">x{existingVehicle.quantity ?? 1}</strong>
                      {" · "}{existingVehicle.daily_rate_low}–{existingVehicle.daily_rate_high}€/ημ.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {existingPlates.length > 0 ? (
                        existingPlates.map((p) => (
                          <span key={p} className="rounded-md border bg-card px-2 py-0.5 font-semibold text-foreground/80">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Χωρίς καταχωρημένες πινακίδες</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Πόσες μονάδες θα προστεθούν</Label>
                    <Input
                      type="number"
                      min={1}
                      value={addCount}
                      onChange={(e) => {
                        const next = Math.max(1, parseInt(e.target.value) || 1);
                        setAddCount(next);
                        setAddPlates((prev) => Array.from({ length: next }, (_, i) => prev[i] ?? ""));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Πινακίδες νέων μονάδων</Label>
                    {Array.from({ length: addCount }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">
                          Μονάδα {(existingVehicle.quantity ?? 1) + i + 1}
                        </span>
                        <Input
                          value={addPlates[i] ?? ""}
                          placeholder="π.χ. ΑΜΗ1234"
                          onChange={(e) => {
                            const next = [...addPlates];
                            next[i] = e.target.value;
                            setAddPlates(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Μετά την προσθήκη: x{(existingVehicle.quantity ?? 1) + addCount} συνολικά.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="bg-card/70 border border-border/80 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
                <h2 className="font-display text-lg">Στοιχεία οχήματος</h2>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Όνομα *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Toyota Aygo" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Τύπος</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: "car", label: "Αυτοκίνητο", icon: Car },
                      { key: "scooter", label: "Scooter", icon: Bike },
                    ] as const).map((t) => {
                      const Icon = t.icon;
                      const active = type === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setType(t.key)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.97]",
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">cc *</Label>
                    <Input type="number" min={0} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="1000" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Τιμή low (€) *</Label>
                    <Input type="number" min={0} step="0.5" value={rateLow} onChange={(e) => setRateLow(e.target.value)} placeholder="25" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Τιμή high (€) *</Label>
                    <Input type="number" min={0} step="0.5" value={rateHigh} onChange={(e) => setRateHigh(e.target.value)} placeholder="45" />
                  </div>
                </div>
              </div>

              <div className="bg-card/70 border border-border/80 rounded-xl p-5 md:p-6 shadow-sm space-y-4">
                <h2 className="font-display text-lg">Στόλος & Πινακίδες</h2>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Ποσότητα (πόσα ίδια οχήματα έχετε)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => {
                      const next = Math.max(1, parseInt(e.target.value) || 1);
                      setQuantity(next);
                      setPlates((prev) => Array.from({ length: next }, (_, i) => prev[i] ?? ""));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Πινακίδες ανά μονάδα</Label>
                  {Array.from({ length: quantity }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Μονάδα {i + 1}</span>
                      <Input
                        value={plates[i] ?? ""}
                        placeholder="π.χ. ΑΜΗ1234"
                        onChange={(e) => {
                          const next = [...plates];
                          next[i] = e.target.value;
                          setPlates(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Σημειώσεις</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Σημειώσεις για το όχημα..." />
                </div>
              </div>
            </>
          )}

          <div className="bg-card/70 border border-border/80 rounded-xl p-5 shadow-sm space-y-3">
            <Button
              type="submit"
              className="w-full text-base font-semibold py-5"
              disabled={createVehicle.isPending || updateVehicle.isPending}
            >
              {effectiveMode === "existing" ? "Προσθήκη μονάδων" : "Προσθήκη στον στόλο"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/fleet")} className="w-full">
              Ακύρωση
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
