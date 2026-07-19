import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPref, setPref, type ThemePref } from "@/lib/theme";

const CYCLE: Record<ThemePref, ThemePref> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABELS: Record<ThemePref, string> = {
  system: "Θέμα συστήματος",
  light: "Φωτεινό θέμα",
  dark: "Σκοτεινό θέμα",
};

export function ThemeToggle() {
  const [pref, setPrefState] = useState<ThemePref>(getPref);

  const cycle = () => {
    const next = CYCLE[pref];
    setPref(next);
    setPrefState(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 coarse:h-11 coarse:w-11"
      onClick={cycle}
      title={LABELS[pref]}
    >
      {pref === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : pref === "light" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
    </Button>
  );
}
