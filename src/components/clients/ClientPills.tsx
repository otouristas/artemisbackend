import { CalendarClock, CheckCircle2, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay, formatEuro, languageLabel, normalizeLanguage, type ClientStats } from "./clientUtils";

export function BalancePill({ stats, compact }: { stats: ClientStats; compact?: boolean }) {
  if (stats.count === 0) return <span className="text-xs text-muted-foreground/60">—</span>;
  if (stats.balance > 0) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning">
        <CircleDollarSign className="h-3 w-3" />
        {formatEuro(stats.balance)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      <CheckCircle2 className="h-3 w-3" />
      {compact ? "OK" : "Εξοφλημένο"}
    </span>
  );
}

export function LanguageChip({ code }: { code: string | null | undefined }) {
  const c = normalizeLanguage(code);
  if (!c) return <span className="text-xs text-muted-foreground/60">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground">
      <span className="inline-flex h-[18px] min-w-[22px] items-center justify-center rounded border bg-muted px-1 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
        {c}
      </span>
      <span className="hidden 2xl:inline">{languageLabel(c)}</span>
    </span>
  );
}

export function TagChips({ tags, max = 2, className }: { tags: string[] | null | undefined; max?: number; className?: string }) {
  const list = tags ?? [];
  if (list.length === 0) return <span className="text-xs text-muted-foreground/60">—</span>;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((t) => (
        <span
          key={t}
          className="inline-flex max-w-[120px] items-center truncate rounded-md border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
        >
          {t}
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] font-medium text-muted-foreground">+{rest}</span>}
    </div>
  );
}

export function RentalWhen({ stats }: { stats: ClientStats }) {
  if (stats.nextRental) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-primary">
        <CalendarClock className="h-3.5 w-3.5" />
        Έρχεται {formatDay(stats.nextRental, "d MMM")}
      </span>
    );
  }
  if (stats.lastRental) {
    return <span className="whitespace-nowrap text-xs tabular-nums text-foreground">{formatDay(stats.lastRental)}</span>;
  }
  return <span className="text-xs text-muted-foreground/60">Καμία ακόμα</span>;
}
