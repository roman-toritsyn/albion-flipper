/**
 * Build data/craft-recipes.json from ao-bin-dumps items.xml.
 * Scope: crested/FW capes + royal gear (flat market-buy ingredients only).
 *
 * Usage: npx tsx scripts/build-craft-recipes.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const XML_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.xml";

const REFINED =
  /_(PLANKS|LEATHER|CLOTH|METALBAR|STONEBLOCK|FIBER|HIDE|ORE|WOOD|ROCK|RUNE|SOUL|RELIC)(@|$)/i;

export type CraftIngredient = { itemId: string; count: number };
export type CraftAlternative = { ingredients: CraftIngredient[] };
export type CraftRecipe = {
  outputId: string;
  enchant: number;
  family: "cape" | "royal";
  alternatives: CraftAlternative[];
};

function withEnchant(uid: string, enchantLevel: number | null): string {
  if (enchantLevel === null || enchantLevel === 0) return uid;
  const base = uid.includes("@") ? uid.slice(0, uid.indexOf("@")) : uid;
  return `${base}@${enchantLevel}`;
}

function parseCraftResources(block: string): CraftIngredient[] | null {
  const ingredients: CraftIngredient[] = [];
  const re = /<craftresource\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const attrs = m[1];
    const uid = /uniquename="([^"]+)"/i.exec(attrs)?.[1];
    if (!uid) continue;
    if (REFINED.test(uid)) return null;
    const count = Number(/count="([^"]+)"/i.exec(attrs)?.[1] ?? "1");
    const enchAttr = /enchantmentlevel="([^"]+)"/i.exec(attrs)?.[1];
    const ench = enchAttr !== undefined ? Number(enchAttr) : null;
    ingredients.push({
      itemId: withEnchant(
        uid,
        ench !== null && Number.isFinite(ench) ? ench : null,
      ),
      count: Number.isFinite(count) ? count : 1,
    });
  }
  return ingredients.length > 0 ? ingredients : null;
}

function extractCraftingRequirementBlocks(section: string): string[] {
  const blocks: string[] = [];
  const re =
    /<craftingrequirements\b[^>]*>([\s\S]*?)<\/craftingrequirements>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    blocks.push(m[1]);
  }
  return blocks;
}

function familyOf(uid: string): "cape" | "royal" | null {
  if (uid.includes("CAPEITEM_") && !uid.endsWith("_BP")) return "cape";
  if (
    uid.includes("_ROYAL") &&
    !uid.includes("TOKEN") &&
    !uid.includes("QUESTITEM")
  ) {
    return "royal";
  }
  return null;
}

function alternativesFromSection(section: string): CraftAlternative[] | null {
  const alts: CraftAlternative[] = [];
  for (const block of extractCraftingRequirementBlocks(section)) {
    const ingredients = parseCraftResources(block);
    if (!ingredients) return null;
    alts.push({ ingredients });
  }
  return alts.length > 0 ? alts : null;
}

export function parseEquipmentBlocks(xml: string): CraftRecipe[] {
  const recipes: CraftRecipe[] = [];
  const itemRe =
    /<(equipmentitem|weapon)\b([^>]*)uniquename="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml))) {
    const uid = m[3];
    const family = familyOf(uid);
    if (!family) continue;
    const body = m[5];

    const enchStart = body.search(/<enchantments[\s>]/i);
    const baseSection = enchStart === -1 ? body : body.slice(0, enchStart);
    const baseAlts = alternativesFromSection(baseSection);
    if (baseAlts) {
      recipes.push({
        outputId: uid,
        enchant: 0,
        family,
        alternatives: baseAlts,
      });
    }

    const enchRe = /<enchantment\b([^>]*)>([\s\S]*?)<\/enchantment>/gi;
    let em: RegExpExecArray | null;
    while ((em = enchRe.exec(body))) {
      const attrs = em[1];
      const level = Number(/enchantmentlevel="([^"]+)"/i.exec(attrs)?.[1] ?? "");
      if (!Number.isFinite(level) || level < 1) continue;
      const alts = alternativesFromSection(em[2]);
      if (!alts) continue;
      recipes.push({
        outputId: withEnchant(uid, level),
        enchant: level,
        family,
        alternatives: alts,
      });
    }
  }

  recipes.sort((a, b) => a.outputId.localeCompare(b.outputId));
  return recipes;
}

async function main() {
  const res = await fetch(XML_URL);
  if (!res.ok) throw new Error(`items.xml HTTP ${res.status}`);
  const xml = await res.text();
  const recipes = parseEquipmentBlocks(xml);
  const path = join(process.cwd(), "data", "craft-recipes.json");
  writeFileSync(path, JSON.stringify(recipes), "utf8");

  const capes = recipes.filter((r) => r.family === "cape").length;
  const royals = recipes.filter((r) => r.family === "royal").length;
  console.log(`wrote ${path}`);
  console.log(`recipes=${recipes.length} cape=${capes} royal=${royals}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
