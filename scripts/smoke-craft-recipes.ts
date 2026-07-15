/**
 * Assert craft-recipes.json has expected cape/royal shape.
 * Usage: npx tsx scripts/smoke-craft-recipes.ts
 */
import recipes from "../data/craft-recipes.json";
import { itemDisplayName } from "../lib/itemNames";

type CraftRecipe = {
  outputId: string;
  enchant: number;
  family: "cape" | "royal";
  alternatives: Array<{
    ingredients: Array<{ itemId: string; count: number }>;
  }>;
};

const list = recipes as CraftRecipe[];

function find(id: string): CraftRecipe | undefined {
  return list.find((r) => r.outputId === id);
}

function hasIngredient(r: CraftRecipe, id: string): boolean {
  return r.alternatives.some((a) => a.ingredients.some((i) => i.itemId === id));
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(list.length > 0, "empty recipes");

const demon0 = find("T4_CAPEITEM_DEMON");
assert(!!demon0, "missing T4_CAPEITEM_DEMON");
assert(demon0!.family === "cape", "demon family");
assert(demon0!.alternatives.length === 1, "demon should have 1 alt");
assert(hasIngredient(demon0!, "T4_CAPE"), "demon needs T4_CAPE");
assert(hasIngredient(demon0!, "T4_CAPEITEM_DEMON_BP"), "demon needs BP");
assert(
  demon0!.alternatives[0].ingredients.some((i) => i.itemId.includes("FACTION")),
  "demon needs faction heart",
);

const demon2 = find("T4_CAPEITEM_DEMON@2");
assert(!!demon2, "missing T4_CAPEITEM_DEMON@2");
assert(hasIngredient(demon2!, "T4_CAPE@2"), "demon@2 needs T4_CAPE@2");

const royal = find("T4_ARMOR_PLATE_ROYAL");
assert(!!royal, "missing T4_ARMOR_PLATE_ROYAL");
assert(royal!.family === "royal", "royal family");
assert(royal!.alternatives.length >= 2, "royal should have multiple bases");
assert(
  hasIngredient(royal!, "QUESTITEM_TOKEN_ROYAL_T4"),
  "royal needs sigil",
);

const REFINED =
  /_(PLANKS|LEATHER|CLOTH|METALBAR|STONEBLOCK|FIBER|HIDE|ORE|WOOD|ROCK|RUNE|SOUL|RELIC)(@|$)/i;
for (const r of list) {
  assert(r.family === "cape" || r.family === "royal", `bad family ${r.outputId}`);
  for (const alt of r.alternatives) {
    for (const ing of alt.ingredients) {
      assert(!REFINED.test(ing.itemId), `refined in ${r.outputId}: ${ing.itemId}`);
    }
  }
}

const capeBases = new Set(
  list.filter((r) => r.family === "cape").map((r) => r.outputId.split("@")[0]),
);
const royalBases = new Set(
  list.filter((r) => r.family === "royal").map((r) => r.outputId.split("@")[0]),
);
assert(capeBases.size >= 50, `expected >=50 cape bases, got ${capeBases.size}`);
assert(royalBases.size >= 40, `expected >=40 royal bases, got ${royalBases.size}`);

const demonName = itemDisplayName("T4_CAPEITEM_DEMON", "EN-US");
assert(
  demonName !== "T4_CAPEITEM_DEMON" && demonName.toLowerCase().includes("demon"),
  `bad demon name: ${demonName}`,
);
const sigilName = itemDisplayName("QUESTITEM_TOKEN_ROYAL_T4", "EN-US");
assert(
  sigilName !== "QUESTITEM_TOKEN_ROYAL_T4",
  `bad sigil name: ${sigilName}`,
);

console.log(
  `smoke-craft-recipes ok (recipes=${list.length} capeBases=${capeBases.size} royalBases=${royalBases.size})`,
);
console.log(`names: ${demonName} / ${sigilName}`);
