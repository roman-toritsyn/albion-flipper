import itemNamesData from "../data/item-names.json";
import type { DumpLang } from "./i18n/types";

type ItemNamesFile = {
  languages: string[];
  names: Record<string, Partial<Record<DumpLang, string>>>;
};

const DATA = itemNamesData as ItemNamesFile;

/** Refined/raw resource enchant: T4_LEATHER_LEVEL2 → base T4_LEATHER, enchant 2. */
function parseLevelEnchant(itemId: string): {
  lookupId: string;
  enchant: number;
} {
  const m = itemId.match(/^(.*)_LEVEL([1-4])$/);
  if (!m) return { lookupId: itemId, enchant: 0 };
  return { lookupId: m[1], enchant: Number(m[2]) };
}

/** Human-readable name from ao-bin-dumps LocalizedNames (AODP has no name field). */
export function itemDisplayName(
  itemId: string,
  lang: DumpLang = "EN-US",
): string {
  const { lookupId, enchant } = parseLevelEnchant(itemId);
  const entry = DATA.names[lookupId] ?? DATA.names[itemId];
  if (!entry) return itemId;
  const name = entry[lang] || entry["EN-US"] || lookupId;
  return enchant > 0 ? `${name} .${enchant}` : name;
}

export function itemNameLanguages(): readonly string[] {
  return DATA.languages;
}
