export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const THEME_COLORS = { light: "#F5F1EA", dark: "#091A24" };

const media = window.matchMedia("(prefers-color-scheme: dark)");
let listening = false;

export function getPref(): ThemePref {
  const stored = localStorage.getItem(STORAGE_KEY);
  // Legacy values from the old boolean toggle were "dark" / "light"
  if (stored === "dark" || stored === "light") return stored;
  return "system";
}

export function setPref(pref: ThemePref) {
  if (pref === "system") {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, pref);
  }
  applyTheme();
}

function resolve(pref: ThemePref): "light" | "dark" {
  return pref === "system" ? (media.matches ? "dark" : "light") : pref;
}

export function applyTheme() {
  const resolved = resolve(getPref());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolved]);
  if (!listening) {
    listening = true;
    media.addEventListener("change", () => {
      if (getPref() === "system") applyTheme();
    });
  }
}
