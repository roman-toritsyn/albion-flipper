import weightsJson from "../data/item-weights.json";

const WEIGHTS = weightsJson as Record<string, number>;

function baseId(itemId: string): string {
  const at = itemId.indexOf("@");
  return at === -1 ? itemId : itemId.slice(0, at);
}

/** Item weight in kg from ao-bin-dumps (per 1 piece). */
export function itemWeightKg(itemId: string): number | null {
  const w = WEIGHTS[itemId] ?? WEIGHTS[baseId(itemId)];
  if (typeof w !== "number" || !Number.isFinite(w) || w < 0) return null;
  return w;
}

/** Numeric weight for display (max 2 decimals). */
export function formatWeightNumber(kg: number): string {
  const n = Math.round(kg * 100) / 100;
  return String(n);
}
