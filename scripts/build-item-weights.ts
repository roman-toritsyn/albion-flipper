/**
 * Build data/item-weights.json from ao-bin-dumps items.xml `weight` attrs
 * for item ids used by refine (+ craft optional) recipes.
 *
 * Usage: npx tsx scripts/build-item-weights.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const XML_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.xml";

type RecipeFile = {
  outputId: string;
  alternatives: Array<{ ingredients: Array<{ itemId: string }> }>;
};

function recipeIds(filename: string): string[] {
  const path = join(process.cwd(), "data", filename);
  if (!existsSync(path)) return [];
  const recipes = JSON.parse(readFileSync(path, "utf8")) as RecipeFile[];
  const ids = new Set<string>();
  for (const r of recipes) {
    ids.add(r.outputId);
    for (const alt of r.alternatives) {
      for (const ing of alt.ingredients) ids.add(ing.itemId);
    }
  }
  return [...ids];
}

/** Parse uniquename + weight from opening tags that carry both attrs. */
export function parseItemWeights(
  xml: string,
  needed: Set<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  // Match any item-like open tag with uniquename and weight (order-independent enough via two passes)
  const tagRe = /<(?:simpleitem|equipmentitem|weapon|consumableitem|mount)\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml))) {
    const attrs = m[1];
    const uid = /uniquename="([^"]+)"/i.exec(attrs)?.[1];
    if (!uid || !needed.has(uid)) continue;
    const wRaw = /(?:^|\s)weight="([^"]+)"/i.exec(attrs)?.[1];
    if (wRaw === undefined) continue;
    const w = Number(wRaw);
    if (!Number.isFinite(w) || w < 0) continue;
    out[uid] = w;
  }
  return out;
}

async function main() {
  const needed = new Set<string>([
    ...recipeIds("refine-recipes.json"),
    ...recipeIds("craft-recipes.json"),
  ]);
  console.log("needed", needed.size);

  const res = await fetch(XML_URL);
  if (!res.ok) throw new Error(`items.xml HTTP ${res.status}`);
  const xml = await res.text();
  const weights = parseItemWeights(xml, needed);

  const path = join(process.cwd(), "data", "item-weights.json");
  writeFileSync(path, JSON.stringify(weights), "utf8");

  const sample = weights["T6_FIBER"];
  if (sample === undefined || Math.abs(sample - 1.14) > 1e-9) {
    throw new Error(`expected T6_FIBER weight 1.14, got ${sample}`);
  }
  console.log(`wrote ${path} entries=${Object.keys(weights).length}`);
  console.log("smoke T6_FIBER=1.14 ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
