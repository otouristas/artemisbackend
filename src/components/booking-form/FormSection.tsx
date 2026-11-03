import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  id?: string;
  step: number;
  icon: LucideIcon;
  title: string;
  description?: string;
  complete?: boolean;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Card with a numbered header — one per logical block of the booking form. */
export function FormSection({
  id,
  step,
  icon: Icon,
  title,
  description,
  complete,
  aside,
  children,
  className,
}: FormSectionProps) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 rounded-xl border bg-card text-card-foreground shadow-sm", className)}
    >
      <header className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
              complete ? "border-success/30 bg-success/10 text-success" : "bg-muted text-foreground/70",
            )}
          >
            {complete ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Icon className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Βήμα {step}
            </p>
            <h2 className="text-base font-semibold leading-tight tracking-tight text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p>}
          </div>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {children}
      </label>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
