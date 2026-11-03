import { useId, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Car, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_SOFT, type Tone } from "./format";

/* ───────────── Layout ───────────── */

/** Full-width page frame: wide on big screens, comfortable gutters on phones. */
export function DashboardContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 pb-10 pt-5 md:px-8 md:pt-8 2xl:px-10", className)}>
      {children}
    </div>
  );
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 md:mb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-[13px] font-medium text-muted-foreground first-letter:uppercase">{eyebrow}</p>
          )}
          <h1 className="font-display text-[30px] font-bold leading-9 tracking-[-0.025em] text-foreground md:text-[38px] md:leading-[1.1]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/* ───────────── Panel (card with header) ───────────── */

export function Panel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 rounded-xl border border-border bg-card", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
        </div>
      )}
      <div className={cn("px-4 pb-4 pt-3 md:px-5 md:pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ───────────── KPI tile ───────────── */

export function DeltaPill({ value, suffix = "%", invert }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        νέο
      </span>
    );
  }
  const up = value > 0;
  const flat = value === 0;
  const good = invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        flat ? "bg-muted text-muted-foreground" : good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {up ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

export function Sparkline({
  data,
  color = "hsl(var(--primary))",
  className,
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className={cn("h-10 w-full", className)} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#spark-${gid})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  delta,
  deltaInvert,
  deltaSuffix,
  spark,
  sparkColor,
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  delta?: number | null;
  deltaInvert?: boolean;
  deltaSuffix?: string;
  spark?: number[];
  sparkColor?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 text-left md:p-5",
        onClick &&
          "pressable cursor-pointer transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-foreground/30 ring-1 ring-foreground/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", TONE_SOFT[tone])}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-foreground md:text-[30px]">
          {value}
        </span>
        {delta !== undefined && <DeltaPill value={delta} invert={deltaInvert} suffix={deltaSuffix} />}
      </div>
      {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
      {spark && spark.length > 1 && <Sparkline data={spark} color={sparkColor} className="mt-3" />}
    </Comp>
  );
}

/* ───────────── Controls ───────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors coarse:min-h-[40px] coarse:px-3",
              selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "rounded px-1 text-[11px] tabular-nums",
                  selected ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── Misc ───────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function VehicleThumb({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Car className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

export function LegendDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]", className)} style={{ background: color }} />;
}
