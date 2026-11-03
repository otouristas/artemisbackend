import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateClient } from "@/hooks/useClients";
import { LANGUAGE_LABELS } from "./clientUtils";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClientDialog({ open, onOpenChange }: CreateClientDialogProps) {
  const navigate = useNavigate();
  const createClient = useCreateClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("");

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setLanguage("");
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await createClient.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        preferred_language: language || null,
      });
      toast.success("Ο πελάτης δημιουργήθηκε");
      onOpenChange(false);
      reset();
      navigate(`/clients/${created.id}`);
    } catch {
      toast.error("Σφάλμα δημιουργίας πελάτη");
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display">Νέος πελάτης</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form
          id="create-client-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Όνομα</Label>
            <Input id="cc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ονοματεπώνυμο" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cc-phone">Τηλέφωνο</Label>
              <Input
                id="cc-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+30 69…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Γλώσσα</Label>
              <Select value={language || "none"} onValueChange={(v) => setLanguage(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-email">Email</Label>
            <Input id="cc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </form>
        <ResponsiveDialogFooter>
          <Button
            type="submit"
            form="create-client-form"
            disabled={!name.trim() || createClient.isPending}
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
