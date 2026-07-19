import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-[28px] leading-9 font-bold tracking-[-0.02em] sm:text-2xl sm:font-semibold sm:tracking-tight md:text-3xl text-foreground">{title}</h1>
        {subtitle && <p className="text-[13px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
