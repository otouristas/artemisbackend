import type { MouseEvent, ReactNode } from "react";
import { Copy, MessageCircle, Phone, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { copyText, whatsappLink } from "./clientUtils";

const stop = (e: MouseEvent) => e.stopPropagation();

interface IconActionProps {
  label: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  tone?: "default" | "success";
  className?: string;
  children: ReactNode;
}

export function IconAction({ label, href, onClick, external, tone = "default", className, children }: IconActionProps) {
  const cls = cn(
    "inline-flex h-6 w-6 coarse:h-9 coarse:w-9 items-center justify-center rounded-md text-muted-foreground transition-colors",
    "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    tone === "success" && "hover:bg-success/10 hover:text-success",
    className,
  );
  const node = href ? (
    <a
      href={href}
      aria-label={label}
      className={cls}
      onClick={stop}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  ) : (
    <button
      type="button"
      aria-label={label}
      className={cls}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Phone value with hover-revealed copy / WhatsApp / call actions (Attio-style cell). */
export function PhoneCell({ phone, revealOnHover = true }: { phone: string; revealOnHover?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="truncate tabular-nums text-[13px] text-foreground">{phone}</span>
      <div
        className={cn(
          "flex shrink-0 items-center",
          revealOnHover && "opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 coarse:opacity-100",
        )}
      >
        <IconAction label="Αντιγραφή τηλεφώνου" onClick={() => void copyText(phone, "Το τηλέφωνο αντιγράφηκε")}>
          <Copy className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction label="WhatsApp" href={whatsappLink(phone)} external tone="success">
          <MessageCircle className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction label="Κλήση" href={`tel:${phone}`}>
          <Phone className="h-3.5 w-3.5" />
        </IconAction>
      </div>
    </div>
  );
}

export function EmailCell({ email, revealOnHover = true }: { email: string; revealOnHover?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="truncate text-xs text-muted-foreground">{email}</span>
      <div
        className={cn(
          "flex shrink-0 items-center",
          revealOnHover && "opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 coarse:opacity-100",
        )}
      >
        <IconAction label="Αντιγραφή email" onClick={() => void copyText(email, "Το email αντιγράφηκε")}>
          <Copy className="h-3 w-3" />
        </IconAction>
        <IconAction label="Αποστολή email" href={`mailto:${email}`}>
          <Mail className="h-3 w-3" />
        </IconAction>
      </div>
    </div>
  );
}
