import { MessageCircle, Phone, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "./ClientAvatar";
import { BalancePill, RentalWhen, TagChips } from "./ClientPills";
import { formatEuro, normalizeLanguage, whatsappLink } from "./clientUtils";
import type { ClientRow } from "./ClientsTable";

export function ClientCardList({ rows, onOpen }: { rows: ClientRow[]; onOpen: (id: string) => void }) {
  return (
    <ul className="overflow-hidden rounded-2xl border bg-card">
      {rows.map(({ client, stats }) => {
        const lang = normalizeLanguage(client.preferred_language);
        return (
          <li key={client.id} className="border-b border-border/70 last:border-b-0">
            <div
              role="link"
              tabIndex={0}
              onClick={() => onOpen(client.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(client.id);
              }}
              className="pressable flex gap-3 px-4 py-3.5 active:bg-muted/60 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <ClientAvatar name={client.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold leading-5 text-foreground">
                      <span className="truncate">{client.name}</span>
                      {stats.count >= 2 && <Repeat className="h-3 w-3 shrink-0 text-accent" aria-label="Επαναλαμβανόμενος" />}
                      {lang && (
                        <span className="shrink-0 rounded border bg-muted px-1 font-mono text-[9px] font-semibold uppercase leading-4 text-muted-foreground">
                          {lang}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] tabular-nums text-muted-foreground">
                      {client.phone || client.email || "Χωρίς στοιχεία επικοινωνίας"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-[15px] font-semibold tabular-nums leading-5", stats.ltv === 0 && "text-muted-foreground/60")}>
                      {stats.ltv > 0 ? formatEuro(stats.ltv) : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {stats.count} {stats.count === 1 ? "κράτηση" : "κρατήσεις"}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                    <BalancePill stats={stats} />
                    <RentalWhen stats={stats} />
                    {(client.tags?.length ?? 0) > 0 && <TagChips tags={client.tags} max={1} />}
                  </div>
                  {client.phone && (
                    <div className="-my-1 -mr-1.5 flex shrink-0 items-center">
                      <a
                        href={whatsappLink(client.phone)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="WhatsApp"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-success active:bg-success/10"
                      >
                        <MessageCircle className="h-[18px] w-[18px]" />
                      </a>
                      <a
                        href={`tel:${client.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Κλήση"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary active:bg-primary/10"
                      >
                        <Phone className="h-[18px] w-[18px]" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
