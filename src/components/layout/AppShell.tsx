import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Car,
  Wallet,
  BarChart3,
  LogOut,
  Plus,
  MoreHorizontal,
  Bell,
  BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.svg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { MoreSheet } from "@/components/layout/MoreSheet";
import { useScrolled } from "@/hooks/use-scrolled";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const navItems = [
  { to: "/", label: "Σήμερα", icon: LayoutDashboard, end: true },
  { to: "/bookings", label: "Κρατήσεις", icon: CalendarDays },
  { to: "/clients", label: "Πελάτες", icon: Users },
  { to: "/fleet", label: "Στόλος", icon: Car },
  { to: "/money", label: "Οικονομικά", icon: Wallet },
  { to: "/insights", label: "Στατιστικά", icon: BarChart3 },
];

const moreRoutes = ["/clients", "/money", "/insights"];

export function AppShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const scrolled = useScrolled(32);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Οι ειδοποιήσεις δεν υποστηρίζονται από αυτή τη συσκευή/πρόγραμμα.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        toast.success("Ενεργοποιήθηκαν οι ειδοποιήσεις!");
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification("Artemis Rental", {
            body: "Οι ειδοποιήσεις σας είναι ενεργές!",
            icon: "/apple-touch-icon.png",
            badge: "/apple-touch-icon.png"
          });
        } else {
          new Notification("Artemis Rental", {
            body: "Οι ειδοποιήσεις σας είναι ενεργές!",
            icon: "/apple-touch-icon.png"
          });
        }
      } else if (permission === "denied") {
        toast.error("Αποκλείστηκε η πρόσβαση στις ειδοποιήσεις. Ενεργοποιήστε τις από τις ρυθμίσεις της συσκευής σας.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close the More sheet on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const mobilePrimary = [
    { to: "/", label: "Σήμερα", icon: LayoutDashboard, end: true },
    { to: "/bookings", label: "Κρατήσεις", icon: CalendarDays },
  ];

  const mobileSecondary = [
    { to: "/fleet", label: "Στόλος", icon: Car },
  ];

  const moreActive = moreRoutes.some((r) => location.pathname.startsWith(r));

  const pageTitle = location.pathname.startsWith("/clients/")
    ? "Πελάτης"
    : navItems.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))?.label ??
      "Artemis";

  return (
    <div className="min-h-screen bg-background md:flex overflow-x-clip">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Artemis Rental" className="h-9 w-auto brightness-0 invert" />
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight truncate">Artemis</p>
              <p className="text-[11px] text-sidebar-foreground/65">CRM · Σίφνος</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 active:scale-[0.97]",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Button
            className="w-full gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 transition-all active:scale-[0.97]"
            onClick={() => navigate("/booking/new")}
          >
            <Plus className="h-4 w-4" />
            Νέα κράτηση
          </Button>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-0.5">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all active:scale-[0.97]",
                  notificationPermission === "default" && "text-amber-500"
                )}
                onClick={requestNotificationPermission}
                title="Ειδοποιήσεις"
              >
                {notificationPermission === "granted" ? (
                  <Bell className="h-4 w-4 text-emerald-500 fill-emerald-500/10" />
                ) : notificationPermission === "denied" ? (
                  <BellOff className="h-4 w-4 text-destructive" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all active:scale-[0.97]"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Έξοδος
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 md:pl-60 min-h-screen flex flex-col pb-24 md:pb-0">
        {/* Mobile top glass header */}
        <header className="md:hidden sticky top-0 z-30 glass-header safe-top">
          <div className="relative flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <img src={logoImg} alt="Artemis" className="h-7 w-auto" />
              <span
                className={cn(
                  "font-display text-base font-semibold tracking-tight transition-opacity duration-200",
                  scrolled && "opacity-0",
                )}
              >
                Artemis
              </span>
            </div>

            {/* Condensed page title — fades in as the large title scrolls away */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold tracking-tight transition-all duration-200",
                scrolled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              {pageTitle}
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 coarse:h-11 coarse:w-11 rounded-full text-foreground active:bg-muted",
                  notificationPermission === "default" && "text-amber-500"
                )}
                onClick={requestNotificationPermission}
              >
                {notificationPermission === "granted" ? (
                  <Bell className="h-4.5 w-4.5 text-emerald-500 fill-emerald-500/10" strokeWidth={2} />
                ) : notificationPermission === "denied" ? (
                  <BellOff className="h-4.5 w-4.5 text-destructive" strokeWidth={2} />
                ) : (
                  <Bell className="h-4.5 w-4.5" strokeWidth={2} />
                )}
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 page-enter">
          <Outlet key={location.pathname} />
        </main>
      </div>

      {/* Mobile iOS liquid-glass tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden safe-bottom">
        <div className="mx-4 mb-3">
          <nav className="flex items-center justify-around rounded-[22px] glass-nav px-1 py-1">
            {mobilePrimary.map((item) => {
              const active = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl min-w-[56px] min-h-[48px] text-[10px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.92]",
                    active ? "text-primary" : "text-foreground/50",
                  )}
                >
                  {active && <span className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20" />}
                  <item.icon className="relative h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}

            {/* Center FAB — new booking */}
            <button
              onClick={() => navigate("/booking/new")}
              className={cn(
                "flex items-center justify-center w-[52px] h-[52px] -mt-5 rounded-full",
                "bg-accent text-accent-foreground backdrop-blur-xl border border-white/30",
                "shadow-[0_4px_20px_hsla(30,57%,51%,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]",
                "active:scale-90 transition-transform duration-200",
              )}
              aria-label="Νέα κράτηση"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>

            {mobileSecondary.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl min-w-[56px] min-h-[48px] text-[10px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.92]",
                    active ? "text-primary" : "text-foreground/50",
                  )}
                >
                  {active && <span className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20" />}
                  <item.icon className="relative h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}

            {/* More — bottom sheet with the remaining destinations */}
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl min-w-[56px] min-h-[48px] text-[10px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.92]",
                moreActive || moreOpen ? "text-primary" : "text-foreground/50",
              )}
            >
              {(moreActive || moreOpen) && (
                <span className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20" />
              )}
              <MoreHorizontal className="relative h-5 w-5" strokeWidth={moreActive || moreOpen ? 2.5 : 1.8} />
              <span className="relative">Περισσότερα</span>
            </button>
          </nav>
        </div>
      </div>

      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        notificationPermission={notificationPermission}
        onRequestNotifications={() => void requestNotificationPermission()}
        onSignOut={() => void signOut()}
      />

      <CommandPalette />
    </div>
  );
}
