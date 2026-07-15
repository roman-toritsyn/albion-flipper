import itemNamesData from "../data/item-names.json";
import type { DumpLang } from "./i18n/types";

type ItemNamesFile = {
  languages: string[];
  names: Record<string, Partial<Record<DumpLang, string>>>;
};

const DATA = itemNamesData as ItemNamesFile;

/** Human-readable name from ao-bin-dumps LocalizedNames (AODP has no name field). */
export function itemDisplayName(
  itemId: string,
  lang: DumpLang = "EN-US",
): string {
  const entry = DATA.names[itemId];
  if (!entry) return itemId;
  return entry[lang] || entry["EN-US"] || itemId;
}

export function itemNameLanguages(): readonly string[] {
  return DATA.languages;
}
