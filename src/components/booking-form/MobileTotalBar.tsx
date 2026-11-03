import { ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEuro } from "./utils";

interface MobileTotalBarProps {
  total: number;
  daysCount: number;
  vehicleName?: string;
  submitLabel: string;
  isSaving: boolean;
  onShowSummary: () => void;
}

/**
 * Sticky total + save bar for phones and tablets (hidden once the summary column
 * is visible on lg). On phones it sits directly above the AppShell tab bar; the
 * after: strip extends the bar's background downwards so no content peeks through
 * if the tab bar is shorter than the reserved offset (the tab bar's z-40 covers it).
 */
export function MobileTotalBar({ total, daysCount, vehicleName, submitLabel, isSaving, onShowSummary }: MobileTotalBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 backdrop-blur after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-background/95 md:bottom-0 md:left-[88px] md:pb-[env(safe-area-inset-bottom)] md:after:hidden lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={onShowSummary}
          className="flex min-w-0 flex-1 flex-col items-start text-left"
          aria-label="Προβολή ανάλυσης τιμής"
        >
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            {daysCount > 0 ? `${daysCount} ημέρ${daysCount === 1 ? "α" : "ες"}` : "Σύνολο"}
            {vehicleName ? <span className="truncate">· {vehicleName}</span> : null}
            <ChevronUp className="h-3 w-3 shrink-0" />
          </span>
          <span className="text-xl font-bold leading-tight tracking-tight tabular-nums text-foreground">
            {formatEuro(total)}
          </span>
        </button>
        <Button type="submit" className="h-11 shrink-0 px-5 text-[15px] font-semibold" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
