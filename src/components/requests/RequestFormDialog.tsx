import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { REQUEST_STATUS_LABELS, SOURCE_LABELS } from "@/lib/status";
import type { BookingRequest } from "@/hooks/useBookingRequests";
import type { Vehicle } from "@/hooks/useVehicles";
import {
  VEHICLE_TYPE_TABS,
  freeUnitsForVehicle,
  type BookingLite,
  type FormState,
  type VehicleTypeFilter,
} from "./requestUtils";

interface RequestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  typeFilter: VehicleTypeFilter;
  onTypeFilterChange: (t: VehicleTypeFilter) => void;
  fleetId: string;
  onFleetIdChange: (id: string) => void;
  fleetOptions: Vehicle[];
  vehicles: Vehicle[];
  bookings: BookingLite[];
  saving: boolean;
  onSave: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

export function RequestFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setField,
  typeFilter,
  onTypeFilterChange,
  fleetId,
  onFleetIdChange,
  fleetOptions,
  vehicles,
  bookings,
  saving,
  onSave,
}: RequestFormDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display">
            {editing ? "Επεξεργασία αιτήματος" : "Νέο αίτημα"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-6">
          <Section title="Πελάτης">
            <div className="space-y-1.5">
              <Label>Όνομα *</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => setField("customer_name", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Τηλέφωνο</Label>
                <Input
                  value={form.customer_phone}
                  onChange={(e) => setField("customer_phone", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setField("customer_email", e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section title="Ταξίδι">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Check-in *</Label>
                <Input
                  type="date"
                  value={form.check_in}
                  onChange={(e) => setField("check_in", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check-out *</Label>
                <Input
                  type="date"
                  value={form.check_out}
                  onChange={(e) => setField("check_out", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
              <Label>Όχημα στόλου (μπορείτε να αλλάξετε τύπο)</Label>
              <div className="flex flex-wrap gap-1.5">
                {VEHICLE_TYPE_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      onTypeFilterChange(t.key);
                      onFleetIdChange("");
                    }}
                    className={cn(
                      "pressable inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      typeFilter === t.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <t.icon className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>
              <Select
                value={fleetId || undefined}
                onValueChange={(id) => {
                  onFleetIdChange(id);
                  const v = vehicles.find((x) => x.id === id);
                  if (v) setField("requested_vehicle", v.name);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε από τον στόλο…" />
                </SelectTrigger>
                <SelectContent>
                  {fleetOptions.map((v) => {
                    const free =
                      form.check_in && form.check_out
                        ? freeUnitsForVehicle(v, form.check_in, form.check_out, bookings)
                        : null;
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.type === "scooter" ? "scooter" : "αυτ."})
                        {free != null ? ` · ${free} διαθέσ.` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Input
                value={form.requested_vehicle}
                onChange={(e) => {
                  setField("requested_vehicle", e.target.value);
                  onFleetIdChange("");
                }}
                placeholder="Ή πληκτρολογήστε ελεύθερα (π.χ. slug από site)"
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Παραλαβή</Label>
                <Input
                  value={form.pickup_location}
                  onChange={(e) => setField("pickup_location", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Επιστροφή</Label>
                <Input
                  value={form.return_location}
                  onChange={(e) => setField("return_location", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Άτομα</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.party_size}
                  onChange={(e) => setField("party_size", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Εκτίμηση €</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estimated_total}
                  onChange={(e) => setField("estimated_total", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <Label htmlFor="child-seat">Παιδικό κάθισμα</Label>
              <Switch
                id="child-seat"
                checked={form.child_seat}
                onCheckedChange={(v) => setField("child_seat", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Άφιξη / πτήσεις</Label>
              <Input
                value={form.arrival_info}
                onChange={(e) => setField("arrival_info", e.target.value)}
              />
            </div>
          </Section>

          <Section title="Μηνύματα & διαχείριση">
            <div className="space-y-1.5">
              <Label>Μήνυμα</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setField("message", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Σημειώσεις γραφείου</Label>
              <Textarea
                value={form.admin_notes}
                onChange={(e) => setField("admin_notes", e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Πηγή</Label>
                <Select value={form.source} onValueChange={(v) => setField("source", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label>Κατάσταση</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setField("status", v as BookingRequest["status"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["new", "reviewed", "accepted", "rejected"] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {REQUEST_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Section>
        </div>
        <ResponsiveDialogFooter>
          <Button
            onClick={onSave}
            disabled={!form.customer_name.trim() || !form.check_in || !form.check_out || saving}
            className="coarse:h-12 coarse:rounded-xl coarse:text-base"
          >
            Αποθήκευση
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="coarse:h-12 coarse:rounded-xl coarse:text-base"
          >
            Ακύρωση
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
