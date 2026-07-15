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
