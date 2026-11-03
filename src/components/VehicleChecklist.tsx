import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, ClipboardCheck, Fuel, Gauge, ImagePlus, KeyRound, Loader2, LogIn, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVehicleChecklists, useCreateChecklist, uploadVehiclePhoto } from "@/hooks/useVehicleChecklists";

interface VehicleChecklistProps {
  bookingId: string;
}

const TYPE_META = {
  check_in: { label: "Παράδοση", long: "Παράδοση (Check-in)", icon: LogOut, chip: "bg-primary/10 text-primary border-primary/20" },
  check_out: { label: "Παραλαβή", long: "Παραλαβή (Check-out)", icon: LogIn, chip: "bg-success/15 text-success border-success/25" },
} as const;

function FuelBar({ level }: { level: number }) {
  const tone = level <= 25 ? "bg-destructive" : level <= 50 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${level}%` }} />
      </span>
      <span className="text-xs font-semibold tabular-nums">{level}%</span>
    </div>
  );
}

export function VehicleChecklist({ bookingId }: VehicleChecklistProps) {
  const { data: checklists = [] } = useVehicleChecklists(bookingId);
  const createChecklist = useCreateChecklist();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"check_in" | "check_out">("check_in");
  const [fuelLevel, setFuelLevel] = useState(100);
  const [mileage, setMileage] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // Default the new checklist to the step that is still missing.
  useEffect(() => {
    if (checklists.some((c) => c.type === "check_in") && !checklists.some((c) => c.type === "check_out")) {
      setType("check_out");
    }
  }, [checklists]);

  const handleSave = async () => {
    setUploading(true);
    try {
      const photoUrls: string[] = [];
      for (const file of photos) {
        const url = await uploadVehiclePhoto(file);
        photoUrls.push(url);
      }
      await createChecklist.mutateAsync({
        booking_id: bookingId,
        type,
        fuel_level: fuelLevel,
        mileage: mileage ? Number(mileage) : 0,
        damage_notes: damageNotes || null,
        photo_urls: photoUrls,
      });
      toast.success("Το checklist αποθηκεύτηκε!");
      setDamageNotes("");
      setPhotos([]);
      setMileage("");
      setFuelLevel(100);
      setOpen(false);
    } catch {
      toast.error("Σφάλμα κατά την αποθήκευση");
    } finally {
      setUploading(false);
    }
  };

  const checkIn = checklists.find((c) => c.type === "check_in");
  const checkOut = checklists.find((c) => c.type === "check_out");
  const kmDriven = checkIn && checkOut && checkOut.mileage > checkIn.mileage ? checkOut.mileage - checkIn.mileage : null;

  return (
    <div className="space-y-3">
      {checklists.length === 0 && !open && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <ClipboardCheck className="h-5 w-5 shrink-0" />
          Δεν έχει καταγραφεί κατάσταση οχήματος για αυτή την κράτηση.
        </div>
      )}

      {checklists.length > 0 && (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {checklists.map((c) => {
            const meta = TYPE_META[c.type as keyof typeof TYPE_META] ?? TYPE_META.check_in;
            const Icon = meta.icon;
            return (
              <li key={c.id} className="relative">
                <span className="absolute -left-[31px] top-3 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                </span>
                <div className="space-y-2.5 rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", meta.chip)}>{meta.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("el", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <FuelBar level={c.fuel_level} />
                    <span className="flex items-center gap-1.5 text-xs">
                      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold tabular-nums">{c.mileage.toLocaleString("el-GR")}</span> km
                    </span>
                  </div>
                  {c.damage_notes && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      {c.damage_notes}
                    </p>
                  )}
                  {c.photo_urls?.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                      {c.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border">
                          <img src={url} alt={`Φωτό ${i + 1}`} className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {kmDriven !== null && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          Διανύθηκαν <span className="font-semibold text-foreground tabular-nums">{kmDriven.toLocaleString("el-GR")} km</span>
          {checkIn && checkOut && checkOut.fuel_level < checkIn.fuel_level && (
            <span> · καύσιμο −{checkIn.fuel_level - checkOut.fuel_level}%</span>
          )}
        </p>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant={open ? "ghost" : "outline"} size="sm" className="w-full gap-1.5">
            <Camera className="h-4 w-4" />
            {open ? "Κλείσιμο checklist" : "Νέο checklist παράδοσης/παραλαβής"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 rounded-xl border bg-card p-4 data-[state=open]:mt-3">
          <div className="space-y-2">
            <Label>Τύπος</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((key) => {
                const meta = TYPE_META[key];
                const Icon = meta.icon;
                const active = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    aria-pressed={active}
                    className={cn(
                      "pressable flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
                      active ? "border-primary bg-primary/5 ring-2 ring-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {meta.long}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5" /> Επίπεδο καυσίμων
              </Label>
              <span className="text-lg font-bold tabular-nums">{fuelLevel}%</span>
            </div>
            <Slider value={[fuelLevel]} onValueChange={([v]) => setFuelLevel(v)} min={0} max={100} step={5} />
            <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
              <span>Ε</span>
              <span>¼</span>
              <span>½</span>
              <span>¾</span>
              <span>Γ</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" /> Χιλιόμετρα
            </Label>
            <Input type="number" min="0" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="π.χ. 12500" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Σημειώσεις ζημιών
            </Label>
            <Textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} placeholder="Περιγράψτε τυχόν ζημιές..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Φωτογραφίες
            </Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {previews.map((src, i) => (
                <div key={src} className="relative overflow-hidden rounded-lg border">
                  <img src={src} alt={`Νέα φωτό ${i + 1}`} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Αφαίρεση φωτογραφίας"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-medium">Προσθήκη</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setPhotos((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.length} αρχείο(α) επιλεγμένα</p>}
          </div>

          <Button onClick={handleSave} disabled={uploading} className="w-full gap-1.5">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            Αποθήκευση checklist
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
