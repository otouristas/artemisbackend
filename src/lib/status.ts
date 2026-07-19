export const STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  confirmed: "Επιβεβαιωμένη",
  cancelled: "Ακυρωμένη",
  in_stay: "Σε ενοικίαση",
  checkout_today: "Αναχώρηση σήμερα",
};

export const STATUS_CHIP: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  confirmed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  in_stay: "bg-primary/10 text-primary border-primary/20",
  checkout_today: "bg-accent/15 text-accent border-accent/30",
};

export const SOURCE_LABELS: Record<string, string> = {
  phone: "Τηλέφωνο",
  walkin: "Walk-in",
  online: "Online",
  email: "Email",
};

export function clientInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
