export const QUALITIES = [1, 2, 3, 4, 5] as const;

export type ItemQuality = (typeof QUALITIES)[number];

/** Short badge text (language-agnostic abbreviations) */
export const QUALITY_SHORT: Record<ItemQuality, string> = {
  1: "Q1",
  2: "Good",
  3: "Outst.",
  4: "Excel.",
  5: "Master",
};

/** @deprecated use i18n quality messages */
export const QUALITY_LABELS_UA: Record<ItemQuality, string> = {
  1: "Звичайна",
  2: "Хороша",
  3: "Видатна",
  4: "Відмінна",
  5: "Шедевр",
};

/** @deprecated use QUALITY_SHORT */
export const QUALITY_SHORT_UA = QUALITY_SHORT;

/** Albion-like quality colors for UI recognition */
export const QUALITY_COLORS: Record<
  ItemQuality,
  { text: string; border: string; bg: string }
> = {
  1: { text: "#c5CAD3", border: "#5a6270", bg: "rgba(90,98,112,0.25)" },
  2: { text: "#6dce7a", border: "#3d8f4a", bg: "rgba(61,143,74,0.22)" },
  3: { text: "#5eb1ff", border: "#2f6fad", bg: "rgba(47,111,173,0.22)" },
  4: { text: "#c79bff", border: "#7a4fb0", bg: "rgba(122,79,176,0.22)" },
  5: { text: "#f0b35a", border: "#b07828", bg: "rgba(176,120,40,0.22)" },
};

export function isItemQuality(n: number): n is ItemQuality {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

export function qualityLabel(quality: number): string {
  if (!isItemQuality(quality)) return `Q${quality}`;
  return `${QUALITY_SHORT[quality]} · ${QUALITY_LABELS_UA[quality]}`;
}

export function qualityKey(itemId: string, quality: number): string {
  return `${itemId}::${quality}`;
}
