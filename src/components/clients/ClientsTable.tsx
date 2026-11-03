import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronRight, Repeat } from "lucide-react";
import type { Client } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "./ClientAvatar";
import { EmailCell, PhoneCell } from "./ContactActions";
import { BalancePill, LanguageChip, RentalWhen, TagChips } from "./ClientPills";
import { formatDay, formatEuro, type ClientStats, type SortKey, type SortState } from "./clientUtils";

export interface ClientRow {
  client: Client;
  stats: ClientStats;
}

interface ClientsTableProps {
  rows: ClientRow[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  onOpen: (id: string) => void;
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "group/sort -mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 uppercase tracking-[0.06em] transition-colors hover:bg-muted hover:text-foreground",
        align === "right" && "flex-row-reverse",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className={cn("h-3 w-3", !active && "opacity-0 group-hover/sort:opacity-60")} />
    </button>
  );
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-10 h-10 whitespace-nowrap border-b bg-muted/60 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/50 first:pl-5 last:pr-5",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function ClientsTable({ rows, sort, onSort, onOpen }: ClientsTableProps) {
  const totals = rows.reduce(
    (acc, r) => ({
      bookings: acc.bookings + r.stats.count,
      ltv: acc.ltv + r.stats.ltv,
      balance: acc.balance + r.stats.balance,
    }),
    { bookings: 0, ltv: 0, balance: 0 },
  );

  return (
    <div className="overflow-clip rounded-xl border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <Th className="w-[30%] lg:w-[22%] xl:w-[20%]">
              <SortHeader label="Πελάτης" sortKey="name" sort={sort} onSort={onSort} />
            </Th>
            <Th className="w-[28%] lg:w-[21%] xl:w-[19%]">Επικοινωνία</Th>
            <Th className="hidden lg:table-cell lg:w-[8%] xl:w-[7%]">Γλώσσα</Th>
            <Th className="w-[12%] text-right lg:w-[9%] xl:w-[8%]">
              <SortHeader label="Κρατήσεις" sortKey="bookings" sort={sort} onSort={onSort} align="right" />
            </Th>
            <Th className="w-[14%] text-right lg:w-[11%] xl:w-[10%]">
              <SortHeader label="Αξία" sortKey="ltv" sort={sort} onSort={onSort} align="right" />
            </Th>
            <Th className="w-[16%] lg:w-[12%] xl:w-[11%]">
              <SortHeader label="Υπόλοιπο" sortKey="balance" sort={sort} onSort={onSort} />
            </Th>
            <Th className="hidden lg:table-cell lg:w-[13%] xl:w-[12%]">
              <SortHeader label="Ενοικίαση" sortKey="last" sort={sort} onSort={onSort} />
            </Th>
            <Th className="hidden xl:table-cell xl:w-[13%]">Ετικέτες</Th>
            <Th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ client, stats }) => (
            <tr
              key={client.id}
              onClick={() => onOpen(client.id)}
              className="group/row cursor-pointer transition-colors hover:bg-muted/40 [&>td]:border-b [&>td]:border-border/70 last:[&>td]:border-b-0"
            >
              <td className="px-3 py-2.5 pl-5">
                <div className="flex min-w-0 items-center gap-3">
                  <ClientAvatar name={client.name} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Link
                        to={`/clients/${client.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {client.name}
                      </Link>
                      {stats.count >= 2 && (
                        <Repeat className="h-3 w-3 shrink-0 text-accent" aria-label="Επαναλαμβανόμενος" />
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Από {formatDay(client.created_at, "MMM yyyy")}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2">
                {client.phone || client.email ? (
                  <div className="min-w-0 space-y-0.5">
                    {client.phone && <PhoneCell phone={client.phone} />}
                    {client.email && <EmailCell email={client.email} />}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/60">Χωρίς στοιχεία</span>
                )}
              </td>
              <td className="hidden px-3 py-2 lg:table-cell">
                <LanguageChip code={client.preferred_language} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={cn("font-medium", stats.count === 0 && "text-muted-foreground/60")}>
                  {stats.count}
                </span>
                {stats.cancelled > 0 && (
                  <span className="ml-1 text-[11px] text-muted-foreground">({stats.cancelled} ακ.)</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {stats.ltv > 0 ? formatEuro(stats.ltv) : <span className="font-normal text-muted-foreground/60">—</span>}
              </td>
              <td className="px-3 py-2">
                <BalancePill stats={stats} />
              </td>
              <td className="hidden px-3 py-2 lg:table-cell">
                <RentalWhen stats={stats} />
              </td>
              <td className="hidden px-3 py-2 xl:table-cell">
                <TagChips tags={client.tags} />
              </td>
              <td className="py-2 pr-4 text-right">
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/40 transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs text-muted-foreground [&>td]:border-t [&>td]:bg-muted/30">
            <td className="px-3 py-2.5 pl-5">
              <span className="font-semibold tabular-nums text-foreground">{rows.length}</span> πελάτες
            </td>
            <td className="px-3 py-2.5" />
            <td className="hidden px-3 py-2.5 lg:table-cell" />
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{totals.bookings}</td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{formatEuro(totals.ltv)}</td>
            <td className="px-3 py-2.5">
              {totals.balance > 0 ? (
                <span className="font-semibold tabular-nums text-warning">{formatEuro(totals.balance)}</span>
              ) : (
                "—"
              )}
            </td>
            <td className="hidden px-3 py-2.5 lg:table-cell" />
            <td className="hidden px-3 py-2.5 xl:table-cell" />
            <td className="py-2.5 pr-4" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
