import { clientInitials } from "@/lib/status";
import { cn } from "@/lib/utils";
import { avatarTone } from "./clientUtils";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl md:h-20 md:w-20 md:text-2xl",
} as const;

interface ClientAvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function ClientAvatar({ name, size = "sm", className }: ClientAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight ring-1 ring-inset ring-foreground/5",
        SIZES[size],
        avatarTone(name),
        className,
      )}
    >
      {clientInitials(name) || "?"}
    </span>
  );
}
