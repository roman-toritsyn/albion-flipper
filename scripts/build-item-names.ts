/**
 * Rebuild data/item-names.json from ao-bin-dumps LocalizedNames
 * for ids listed in data/items.json.
 *
 * Usage: npx tsx scripts/build-item-names.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import items from "../data/items.json";

const DUMP_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

type DumpEntry = {
  UniqueName?: string;
  LocalizedNames?: Record<string, string>;
};

async function main() {
  const needed = new Set(items as string[]);
  console.log("needed", needed.size);

  const res = await fetch(DUMP_URL);
  if (!res.ok) throw new Error(`dump HTTP ${res.status}`);
  const data = (await res.json()) as DumpEntry[];

  let languages: string[] | null = null;
  const names: Record<string, Record<string, string>> = {};

  for (const entry of data) {
    const uid = entry.UniqueName;
    if (!uid || !needed.has(uid)) continue;
    const loc = entry.LocalizedNames;
    if (!loc) continue;
    if (!languages) languages = Object.keys(loc).sort();
    names[uid] = Object.fromEntries(
      Object.entries(loc).filter(([, v]) => Boolean(v)),
    );
  }

  const out = {
    languages: languages ?? [],
    names,
  };
  const path = join(process.cwd(), "data", "item-names.json");
  writeFileSync(path, JSON.stringify(out), "utf8");
  console.log("langs", out.languages);
  console.log("matched", Object.keys(names).length, "of", needed.size);
  console.log("wrote", path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
