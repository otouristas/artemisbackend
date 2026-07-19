import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bike, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCreateVehicle } from "@/hooks/useCreateVehicle";

export default function FleetFormPage() {
  const navigate = useNavigate();
  const createVehicle = useCreateVehicle();

  const [name, setName] = useState("");
  const [type, setType] = useState<"car" | "scooter">("car");
  const [cc, setCc] = useState("");
  const [rateLow, setRateLow] = useState("");
  const [rateHigh, setRateHigh] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [plates, setPlates] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
              Τύπος · Τιμές · Ποσότητα · Πινακίδες
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="bg-card/70 border border-border/80 rounded-xl p-5 shadow-sm space-y-3">
            <Button type="submit" className="w-full text-base font-semibold py-5" disabled={createVehicle.isPending}>
              Προσθήκη στον στόλο
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
