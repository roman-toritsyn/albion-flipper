export function formatSilver(n: number): string {
  return Math.round(n).toLocaleString("uk-UA");
}

export function formatSignedSilver(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("uk-UA")}`;
}

export function formatRoi(roi: number): string {
  return `${(roi * 100).toFixed(1)}%`;
}

export function itemIconUrl(itemId: string, quality: number = 1): string {
  const q = Number.isFinite(quality) && quality >= 1 && quality <= 5 ? quality : 1;
  return `https://render.albiononline.com/v1/item/${itemId}.png?quality=${q}`;
}

/** Albion market shorthand: T7_MAIN_SWORD@2 → "7.2", T7_BAG → "7.0". */
export function formatItemTierEnchant(itemId: string): string | null {
  const m = /^T(\d+)/.exec(itemId);
  if (!m) return null;
  const at = itemId.indexOf("@");
  const enchant =
    at >= 0 ? Number.parseInt(itemId.slice(at + 1), 10) : 0;
  if (!Number.isFinite(enchant) || enchant < 0) return `${m[1]}.0`;
  return `${m[1]}.${enchant}`;
}
