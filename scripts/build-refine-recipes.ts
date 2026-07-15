/**
 * Build data/refine-recipes.json from ao-bin-dumps items.xml.
 * Scope: refined resources (bars/planks/cloth/leather/stoneblocks).
 *
 * Usage: npx tsx scripts/build-refine-recipes.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const XML_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.xml";

export type RefineFamily = "bars" | "planks" | "cloth" | "leather" | "stone";

export type RefineIngredient = { itemId: string; count: number };

export type RefineRecipe = {
  outputId: string;
  enchant: number;
  tier: number;
  family: RefineFamily;
  alternatives: Array<{ ingredients: RefineIngredient[] }>;
};

const FAMILY_FROM_CATEGORY: Record<string, RefineFamily> = {
  ore: "bars",
  wood: "planks",
  fiber: "cloth",
  hide: "leather",
  rock: "stone",
};

function parseIngredients(block: string): RefineIngredient[] | null {
  const ingredients: RefineIngredient[] = [];
  const re = /<craftresource\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const attrs = m[1];
    const uid = /uniquename="([^"]+)"/i.exec(attrs)?.[1];
    if (!uid) continue;
    const count = Number(/count="([^"]+)"/i.exec(attrs)?.[1] ?? "1");
    ingredients.push({
      itemId: uid,
      count: Number.isFinite(count) && count > 0 ? count : 1,
    });
  }
  return ingredients.length > 0 ? ingredients : null;
}

function extractRequirementBlocks(section: string): string[] {
  const blocks: string[] = [];
  const re =
    /<craftingrequirements\b[^>]*>([\s\S]*?)<\/craftingrequirements>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    blocks.push(m[1]);
  }
  return blocks;
}

/** Prefer market-only alts (no faction tokens) first. */
function sortAlternatives(
  alts: Array<{ ingredients: RefineIngredient[] }>,
): Array<{ ingredients: RefineIngredient[] }> {
  const isToken = (a: { ingredients: RefineIngredient[] }) =>
    a.ingredients.some(
      (i) =>
        i.itemId.includes("FACTION") ||
        i.itemId.includes("TOKEN") ||
        i.itemId.includes("QUESTITEM"),
    );
  return [...alts].sort((a, b) => Number(isToken(a)) - Number(isToken(b)));
}

export function parseRefineRecipes(xml: string): RefineRecipe[] {
  const recipes: RefineRecipe[] = [];
  const itemRe = /<simpleitem\b([^>]*)>([\s\S]*?)<\/simpleitem>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml))) {
    const attrs = m[1];
    const body = m[2];
    if (!/shopsubcategory1="refinedresources"/i.test(attrs)) continue;
    if (!/CRAFTBUILDING_ITEM_DETAILS_BUTTON_REFINE/i.test(body)) continue;

    const uid = /uniquename="([^"]+)"/i.exec(attrs)?.[1];
    if (!uid) continue;

    const category = /craftingcategory="([^"]+)"/i.exec(attrs)?.[1]?.toLowerCase();
    const family = category ? FAMILY_FROM_CATEGORY[category] : undefined;
    if (!family) continue;

    const tier = Number(/tier="([^"]+)"/i.exec(attrs)?.[1] ?? "");
    if (!Number.isFinite(tier) || tier < 2 || tier > 8) continue;

    const enchantAttr = /enchantmentlevel="([^"]+)"/i.exec(attrs)?.[1];
    const enchant = enchantAttr !== undefined ? Number(enchantAttr) : 0;
    if (!Number.isFinite(enchant) || enchant < 0) continue;

    const alts: Array<{ ingredients: RefineIngredient[] }> = [];
    for (const block of extractRequirementBlocks(body)) {
      const ingredients = parseIngredients(block);
      if (!ingredients) continue;
      alts.push({ ingredients });
    }
    if (alts.length === 0) continue;

    recipes.push({
      outputId: uid,
      enchant,
      tier,
      family,
      alternatives: sortAlternatives(alts),
    });
  }

  recipes.sort((a, b) => a.outputId.localeCompare(b.outputId));
  return recipes;
}

async function main() {
  const res = await fetch(XML_URL);
  if (!res.ok) throw new Error(`items.xml HTTP ${res.status}`);
  const xml = await res.text();
  const recipes = parseRefineRecipes(xml);
  const path = join(process.cwd(), "data", "refine-recipes.json");
  writeFileSync(path, JSON.stringify(recipes), "utf8");

  const byFamily: Record<string, number> = {};
  for (const r of recipes) {
    byFamily[r.family] = (byFamily[r.family] || 0) + 1;
  }
  console.log(`wrote ${path}`);
  console.log(`recipes=${recipes.length}`, byFamily);

  const t5 = recipes.find((r) => r.outputId === "T5_METALBAR");
  if (!t5) throw new Error("missing T5_METALBAR");
  const first = t5.alternatives[0].ingredients;
  const ore = first.find((i) => i.itemId === "T5_ORE");
  const bar = first.find((i) => i.itemId === "T4_METALBAR");
  if (!ore || ore.count !== 3 || !bar || bar.count !== 1) {
    throw new Error(`T5_METALBAR recipe unexpected: ${JSON.stringify(first)}`);
  }
  console.log("smoke T5_METALBAR ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
