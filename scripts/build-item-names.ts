/**
 * Rebuild data/item-names.json from ao-bin-dumps LocalizedNames
 * for ids in data/items.json + data/craft-recipes.json.
 *
 * Usage: npx tsx scripts/build-item-names.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import items from "../data/items.json";

const DUMP_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

type DumpEntry = {
  UniqueName?: string;
  LocalizedNames?: Record<string, string>;
};

type CraftRecipe = {
  outputId: string;
  alternatives: Array<{ ingredients: Array<{ itemId: string }> }>;
};

function craftIds(): string[] {
  const path = join(process.cwd(), "data", "craft-recipes.json");
  if (!existsSync(path)) return [];
  const recipes = JSON.parse(readFileSync(path, "utf8")) as CraftRecipe[];
  const ids = new Set<string>();
  for (const r of recipes) {
    ids.add(r.outputId);
    for (const alt of r.alternatives) {
      for (const ing of alt.ingredients) ids.add(ing.itemId);
    }
  }
  return [...ids];
}

function baseId(id: string): string {
  const at = id.indexOf("@");
  return at === -1 ? id : id.slice(0, at);
}

async function main() {
  const needed = new Set<string>([...(items as string[]), ...craftIds()]);
  console.log("needed", needed.size);

  const res = await fetch(DUMP_URL);
  if (!res.ok) throw new Error(`dump HTTP ${res.status}`);
  const data = (await res.json()) as DumpEntry[];

  const byUid = new Map<string, Record<string, string>>();
  let languages: string[] | null = null;

  for (const entry of data) {
    const uid = entry.UniqueName;
    if (!uid || !entry.LocalizedNames) continue;
    if (!languages) languages = Object.keys(entry.LocalizedNames).sort();
    byUid.set(
      uid,
      Object.fromEntries(
        Object.entries(entry.LocalizedNames).filter(([, v]) => Boolean(v)),
      ),
    );
  }

  const names: Record<string, Record<string, string>> = {};
  let matched = 0;
  for (const id of needed) {
    const loc = byUid.get(id) ?? byUid.get(baseId(id));
    if (!loc) continue;
    names[id] = loc;
    matched++;
  }

  const out = {
    languages: languages ?? [],
    names,
  };
  const path = join(process.cwd(), "data", "item-names.json");
  writeFileSync(path, JSON.stringify(out), "utf8");
  console.log("langs", out.languages);
  console.log("matched", matched, "of", needed.size);
  console.log("wrote", path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
