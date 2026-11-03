/** Shape shared by both pricing engines (vehicle_rates + legacy season table). */
export interface BreakdownLike {
  available: boolean;
  baseTotal: number;
  segments: { label: string; days: number; rate: number; subtotal: number }[];
}

export interface ExtraFee {
  id: string;
  label: string;
  amount: number;
}

export interface VehicleAvailability {
  booked: number;
  free: number;
  quantity: number;
}

export function formatEuro(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toLocaleString("el-GR", { maximumFractionDigits: 2 })}€`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export type AvailabilityTone = "idle" | "free" | "partial" | "full";

export function availabilityTone(hasVehicle: boolean, hasDates: boolean, conflicts: number, freeUnits: number): AvailabilityTone {
  if (!hasVehicle || !hasDates) return "idle";
  if (conflicts === 0) return "free";
  return freeUnits > 0 ? "partial" : "full";
}
