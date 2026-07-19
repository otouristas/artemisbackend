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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.svg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { useState, useEffect } from "react";

const navItems = [
  { to: "/", label: "Σήμερα", icon: LayoutDashboard, end: true },
  { to: "/bookings", label: "Κρατήσεις", icon: CalendarDays },
  { to: "/clients", label: "Πελάτες", icon: Users },
  { to: "/fleet", label: "Στόλος", icon: Car },
  { to: "/money", label: "Οικονομικά", icon: Wallet },
  { to: "/insights", label: "Στατιστικά", icon: BarChart3 },
];

export function AppShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on location change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const mobilePrimary = [
    { to: "/", label: "Σήμερα", icon: LayoutDashboard, end: true },
    { to: "/bookings", label: "Κρατήσεις", icon: CalendarDays },
  ];

  const mobileSecondary = [
    { to: "/fleet", label: "Στόλος", icon: Car },
  ];

  return (
    <div className="min-h-screen bg-background md:flex overflow-x-hidden">
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
            <ThemeToggle />
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

      {/* Mobile slide-out glass sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-md transition-opacity animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Slide-out Panel */}
          <div className="relative flex w-full max-w-[280px] flex-1 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border pt-5 pb-4 transition-transform animate-slide-in-left shadow-2xl">
            <div className="absolute top-3 right-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex shrink-0 items-center px-5 border-b border-sidebar-border/30 pb-5">
              <div className="flex items-center gap-3">
                <img src={logoImg} alt="Artemis Rental" className="h-9 w-auto brightness-0 invert" />
                <div className="min-w-0">
                  <p className="font-display text-lg leading-tight truncate">Artemis</p>
                  <p className="text-[11px] text-sidebar-foreground/65">CRM · Σίφνος</p>
                </div>
              </div>
            </div>

            <div className="mt-4 h-0 flex-1 overflow-y-auto px-3">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-all active:scale-[0.97]",
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
            </div>

            <div className="p-4 border-t border-sidebar-border/30 space-y-3">
              <Button
                className="w-full gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 rounded-xl active:scale-[0.97] transition-all"
                onClick={() => navigate("/booking/new")}
              >
                <Plus className="h-4 w-4" />
                Νέα κράτηση
              </Button>
              <div className="flex items-center justify-between px-1 pt-1">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
                  onClick={() => void signOut()}
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Έξοδος
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 md:pl-60 min-h-screen flex flex-col pb-20 md:pb-0">
        {/* Mobile top glass header */}
        <header className="md:hidden sticky top-0 z-30 glass-header px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-foreground rounded-full active:bg-muted"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5.5 w-5.5" />
            </Button>
            <img src={logoImg} alt="Artemis" className="h-7 w-auto" />
            <span className="font-display text-base font-semibold tracking-tight">Artemis</span>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 page-enter">
          <Outlet key={location.pathname} />
        </main>
      </div>

      {/* Mobile Bottom iOS 27 glass tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden safe-bottom"
      >
        <div className="mx-4 mb-3">
          <nav className="flex items-center justify-around rounded-2xl glass-nav px-1 py-1 shadow-xl">
            {mobilePrimary.map((item) => {
              const active = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] text-[10px] font-semibold transition-all duration-200 active:scale-[0.92]",
                    active ? "text-accent bg-accent/10" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  {item.label}
                </button>
              );
            })}

            {/* Float + FAB in center */}
            <button
              onClick={() => navigate("/booking/new")}
              className="flex items-center justify-center w-12 h-12 -mt-5 rounded-full bg-accent text-accent-foreground shadow-lg active:scale-90 transition-all hover:bg-accent/95 hover:shadow-accent/20 border-2 border-background"
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
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] text-[10px] font-semibold transition-all duration-200 active:scale-[0.92]",
                    active ? "text-accent bg-accent/10" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  {item.label}
                </button>
              );
            })}

            {/* Menu tab button triggers sidebar */}
            <button
              onClick={() => setSidebarOpen(true)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] text-[10px] font-semibold text-muted-foreground transition-all duration-200 active:scale-[0.92]",
                sidebarOpen && "text-accent bg-accent/10"
              )}
            >
              <Menu className="h-5 w-5" />
              Μενού
            </button>
          </nav>
        </div>
      </div>

      <CommandPalette />
    </div>
  );
}
