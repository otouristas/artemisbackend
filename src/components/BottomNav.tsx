import { CalendarDays, List, Plus, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "calendar" | "list" | "clients" | "analytics";

interface BottomNavProps {
  view: View;
  onViewChange: (view: View) => void;
  onNewBooking: () => void;
}

const tabs: { value: View; label: string; icon: typeof CalendarDays }[] = [
  { value: "calendar", label: "Ημερ.", icon: CalendarDays },
  { value: "list", label: "Λίστα", icon: List },
  { value: "clients", label: "Πελάτες", icon: Users },
  { value: "analytics", label: "Στατ.", icon: BarChart3 },
];

export function BottomNav({ view, onViewChange, onNewBooking }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Floating pill container */}
      <div className="mx-3 mb-2">
        <nav
          className={cn(
            "relative flex items-center justify-around rounded-[22px] px-1 py-1",
            // Liquid Glass effect
            "bg-white/40 dark:bg-white/10",
            "backdrop-blur-2xl backdrop-saturate-[1.8]",
            "border border-white/50 dark:border-white/20",
            "shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.4)]",
            "dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]",
          )}
        >
          {tabs.slice(0, 2).map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onViewChange(tab.value)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl transition-all duration-300 min-w-[52px]",
                  active
                    ? "text-primary"
                    : "text-foreground/50 active:scale-95"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20 backdrop-blur-sm" />
                )}
                <Icon className="relative h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                <span className="relative text-[10px] font-semibold tracking-tight">{tab.label}</span>
              </button>
            );
          })}

          {/* Center FAB — Liquid Glass style */}
          <button
            onClick={onNewBooking}
            className={cn(
              "flex items-center justify-center w-[52px] h-[52px] -mt-5 rounded-full",
              "bg-primary/80 backdrop-blur-xl",
              "text-primary-foreground",
              "border border-white/30",
              "shadow-[0_4px_20px_rgba(10,107,204,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]",
              "active:scale-90 transition-transform duration-200"
            )}
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>

          {tabs.slice(2).map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onViewChange(tab.value)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl transition-all duration-300 min-w-[52px]",
                  active
                    ? "text-primary"
                    : "text-foreground/50 active:scale-95"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20 backdrop-blur-sm" />
                )}
                <Icon className="relative h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                <span className="relative text-[10px] font-semibold tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
