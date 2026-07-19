import { useState } from "react";
import { Fuel, Gauge, Camera, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useVehicleChecklists, useCreateChecklist, uploadVehiclePhoto } from "@/hooks/useVehicleChecklists";

interface VehicleChecklistProps {
  bookingId: string;
}

export function VehicleChecklist({ bookingId }: VehicleChecklistProps) {
  const { data: checklists = [], isLoading } = useVehicleChecklists(bookingId);
  const createChecklist = useCreateChecklist();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"check_in" | "check_out">("check_in");
  const [fuelLevel, setFuelLevel] = useState(100);
  const [mileage, setMileage] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setUploading(true);
    try {
      let photoUrls: string[] = [];
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

  return (
    <div className="space-y-3">
      {checklists.map((c) => (
        <div key={c.id} className="rounded-lg border p-3 space-y-1 bg-muted/30">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {c.type === "check_in" ? "Παράδοση" : "Παραλαβή"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleDateString("el")}
            </span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1"><Fuel className="h-3 w-3" /> {c.fuel_level}%</span>
            <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> {c.mileage} km</span>
          </div>
          {c.damage_notes && (
            <p className="text-sm text-muted-foreground flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 text-warning" />
              {c.damage_notes}
            </p>
          )}
          {c.photo_urls?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {c.photo_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener">
                  <img src={url} alt={`Φωτό ${i + 1}`} className="h-16 w-16 object-cover rounded border" />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-1.5">
            <Camera className="h-4 w-4" />
            {open ? "Κλείσιμο checklist" : "Νέο checklist παράδοσης/παραλαβής"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="space-y-2">
            <Label>Τύπος</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check_in">Παράδοση (Check-in)</SelectItem>
                <SelectItem value="check_out">Παραλαβή (Check-out)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Fuel className="h-3.5 w-3.5" /> Επίπεδο καυσίμων: {fuelLevel}%
            </Label>
            <Slider
              value={[fuelLevel]}
              onValueChange={([v]) => setFuelLevel(v)}
              min={0}
              max={100}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" /> Χιλιόμετρα
            </Label>
            <Input
              type="number"
              min="0"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="π.χ. 12500"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Σημειώσεις ζημιών
            </Label>
            <Textarea
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="Περιγράψτε τυχόν ζημιές..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" /> Φωτογραφίες
            </Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files || []))}
            />
            {photos.length > 0 && (
              <p className="text-xs text-muted-foreground">{photos.length} αρχείο(α) επιλεγμένα</p>
            )}
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
