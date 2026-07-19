import { useNavigate, useLocation } from "react-router-dom";
import { Users, Wallet, BarChart3, Bell, BellOff, LogOut, ChevronRight, Sun, Moon, Monitor } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { getPref, setPref, type ThemePref } from "@/lib/theme";

const navRows = [
  { to: "/clients", label: "Πελάτες", icon: Users },
  { to: "/money", label: "Οικονομικά", icon: Wallet },
  { to: "/insights", label: "Στατιστικά", icon: BarChart3 },
];

const THEME_CYCLE: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const THEME_LABELS: Record<ThemePref, string> = {
  system: "Σύστημα",
  light: "Φωτεινό",
  dark: "Σκοτεινό",
};
const THEME_ICONS: Record<ThemePref, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notificationPermission: NotificationPermission;
  onRequestNotifications: () => void;
  onSignOut: () => void;
}

export function MoreSheet({
  open,
  onOpenChange,
  notificationPermission,
  onRequestNotifications,
  onSignOut,
}: MoreSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [themePref, setThemePref] = useState<ThemePref>(getPref);
  const ThemeIcon = THEME_ICONS[themePref];

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="px-4 pb-3 text-left">
          <DrawerTitle className="font-display">Περισσότερα</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-2">
          <div className="inset-group border">
            {navRows.map((row) => {
              const active = location.pathname.startsWith(row.to);
              return (
                <button
                  key={row.to}
                  onClick={() => go(row.to)}
                  className="pressable inset-row w-full gap-3 text-left"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <row.icon className="h-4 w-4" />
                  </span>
                  <span className={cn("flex-1 text-[15px]", active ? "font-semibold text-primary" : "font-medium")}>
                    {row.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
              );
            })}
          </div>

          <div className="inset-group border">
            <button
              onClick={() => {
                const next = THEME_CYCLE[themePref];
                setPref(next);
                setThemePref(next);
              }}
              className="pressable inset-row w-full gap-3 text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ThemeIcon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[15px] font-medium">Εμφάνιση</span>
              <span className="text-sm text-muted-foreground">{THEME_LABELS[themePref]}</span>
            </button>

            <button onClick={onRequestNotifications} className="pressable inset-row w-full gap-3 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {notificationPermission === "denied" ? (
                  <BellOff className="h-4 w-4 text-destructive" />
                ) : (
                  <Bell className={cn("h-4 w-4", notificationPermission === "granted" && "text-emerald-500")} />
                )}
              </span>
              <span className="flex-1 text-[15px] font-medium">Ειδοποιήσεις</span>
              <span className="text-sm text-muted-foreground">
                {notificationPermission === "granted"
                  ? "Ενεργές"
                  : notificationPermission === "denied"
                    ? "Αποκλεισμένες"
                    : "Ανενεργές"}
              </span>
            </button>
          </div>

          <div className="inset-group border">
            <button
              onClick={() => {
                onOpenChange(false);
                onSignOut();
              }}
              className="pressable inset-row w-full justify-center gap-2 text-[15px] font-semibold text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Έξοδος
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
