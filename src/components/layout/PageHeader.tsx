import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
      <div>
        <h1 className="font-display text-[30px] leading-9 font-bold tracking-[-0.025em] md:text-[40px] md:leading-[1.1] text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5 first-letter:uppercase">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
