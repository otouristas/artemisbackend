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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.svg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [moreOpen, setMoreOpen] = useState(false);

  const mobilePrimary = navItems.slice(0, 3);
  const mobileMore = navItems.slice(3);

  return (
    <div className="min-h-screen bg-background md:flex">
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
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
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
            className="w-full gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
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
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Έξοδος
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:pl-60 min-h-screen flex flex-col pb-24 md:pb-0">
        <header className="md:hidden sticky top-0 z-30 border-b bg-card/90 backdrop-blur px-4 py-2.5 flex items-center gap-3">
          <img src={logoImg} alt="Artemis" className="h-7" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-base truncate">Artemis CRM</p>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 page-enter">
          <Outlet key={location.pathname} />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-3 mb-2">
          <nav className="flex items-center justify-around rounded-2xl border bg-card/95 backdrop-blur-xl px-1 py-1 shadow-lg">
            {mobilePrimary.map((item) => {
              const active =
                item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] text-[10px] font-semibold",
                    active ? "text-primary bg-primary/10" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  {item.label}
                </button>
              );
            })}

            <button
              onClick={() => navigate("/booking/new")}
              className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-accent text-accent-foreground shadow-md active:scale-95 transition-transform"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>

            <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] text-[10px] font-semibold",
                    mobileMore.some((i) => location.pathname.startsWith(i.to))
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground",
                  )}
                >
                  <MoreHorizontal className="h-5 w-5" />
                  Άλλα
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="mb-2">
                {mobileMore.map((item) => (
                  <DropdownMenuItem
                    key={item.to}
                    onClick={() => {
                      navigate(item.to);
                      setMoreOpen(false);
                    }}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Έξοδος
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>

      <CommandPalette />
    </div>
  );
}
