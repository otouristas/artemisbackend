import { useState } from "react";
import { GitMerge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMergeClients, type Client } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "./ClientAvatar";
import { formatDay } from "./clientUtils";

interface MergeDuplicatesCardProps {
  keepId: string;
  keepName: string;
  duplicates: Client[];
}

export function MergeDuplicatesCard({ keepId, keepName, duplicates }: MergeDuplicatesCardProps) {
  const mergeClients = useMergeClients();
  const [mergeId, setMergeId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selected = duplicates.find((d) => d.id === mergeId);

  const handleMerge = async () => {
    if (!mergeId) return;
    try {
      await mergeClients.mutateAsync({ keepId, mergeId });
      toast.success("Οι πελάτες συγχωνεύθηκαν");
      setMergeId("");
    } catch {
      toast.error("Σφάλμα συγχώνευσης");
    } finally {
      setConfirmOpen(false);
    }
  };

  if (duplicates.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-accent/40 bg-accent/5">
      <div className="flex items-start gap-3 px-4 py-3.5 md:px-5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <GitMerge className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Πιθανά διπλότυπα</h2>
          <p className="text-xs text-muted-foreground">
            Βρέθηκαν πελάτες με το ίδιο τηλέφωνο. Συγχωνεύστε σε αυτό το προφίλ.
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 px-3 pb-3 md:px-4">
        {duplicates.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => setMergeId(d.id === mergeId ? "" : d.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                mergeId === d.id && "border-accent ring-1 ring-accent",
              )}
            >
              <ClientAvatar name={d.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[d.phone, d.email, `από ${formatDay(d.created_at, "d MMM yyyy")}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full border-2",
                  mergeId === d.id ? "border-accent bg-accent shadow-[inset_0_0_0_2px_hsl(var(--card))]" : "border-input",
                )}
              />
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-accent/20 px-3 py-3 md:px-4">
        <Button
          size="sm"
          className="w-full gap-1.5 coarse:h-11"
          disabled={!mergeId || mergeClients.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <GitMerge className="h-4 w-4" />
          Συγχώνευση
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Συγχώνευση πελατών;</AlertDialogTitle>
            <AlertDialogDescription>
              Οι κρατήσεις του «{selected?.name}» θα μεταφερθούν στον «{keepName}» και το διπλότυπο προφίλ θα διαγραφεί.
              Η ενέργεια δεν αναιρείται.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleMerge();
              }}
              disabled={mergeClients.isPending}
            >
              Συγχώνευση
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
