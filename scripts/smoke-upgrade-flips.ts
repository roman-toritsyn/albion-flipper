/**
 * Fixture smoke for buildUpgradeFlips (no network).
 * Usage: npx tsx scripts/smoke-upgrade-flips.ts
 */
import recipesJson from "../data/upgrade-recipes.json";
import {
  buildUpgradeFlips,
  upgradeProfit,
  withEnchant,
  type UpgradeRecipe,
} from "../lib/upgradeFlips";
import type { AodpPriceRow } from "../lib/types";
import { classify } from "./build-upgrade-recipes";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function row(
  item_id: string,
  city: string,
  quality: number,
  sell_price_min: number,
  buy_price_max: number,
): AodpPriceRow {
  return {
    item_id,
    city,
    quality,
    sell_price_min,
    sell_price_min_date: "2026-07-15T10:00:00",
    sell_price_max: 0,
    sell_price_max_date: "",
    buy_price_min: 0,
    buy_price_min_date: "",
    buy_price_max,
    buy_price_max_date: "2026-07-15T10:00:00",
  };
}

const capeRecipe: UpgradeRecipe = {
  baseId: "T4_CAPE",
  tier: 4,
  slot: "small",
  family: "cape",
  matCount: 96,
  fromEnchant: 0,
  toEnchant: 1,
  mats: [{ kind: "RUNE", itemId: "T4_RUNE", count: 96 }],
};

const multiRecipe: UpgradeRecipe = {
  baseId: "T5_MAIN_SWORD",
  tier: 5,
  slot: "oneHand",
  family: "weapon",
  matCount: 288,
  fromEnchant: 0,
  toEnchant: 2,
  mats: [
    { kind: "RUNE", itemId: "T5_RUNE", count: 288 },
    { kind: "SOUL", itemId: "T5_SOUL", count: 288 },
  ],
};

assert(withEnchant("T4_CAPE", 0) === "T4_CAPE", "base id");
assert(withEnchant("T4_CAPE", 1) === "T4_CAPE@1", "enchant id");

// 1) Auto: mix cheapest cities for gear + mats
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Martlock", 1, 10_000, 0),
    row("T4_CAPE", "Bridgewatch", 1, 12_000, 0),
    row("T4_RUNE", "Thetford", 1, 100, 0),
    row("T4_RUNE", "Martlock", 1, 200, 0),
    row("T4_CAPE@1", "Black Market", 1, 0, 30_000),
  ];
  const flips = buildUpgradeFlips(rows, {
    buyCity: "auto",
    qualities: [1],
    recipes: [capeRecipe],
  });
  assert(flips.length === 1, `auto flips ${flips.length}`);
  const f = flips[0];
  assert(f.cost === 10_000 + 96 * 100, `auto cost ${f.cost}`);
  assert(
    f.ingredients.find((i) => i.itemId === "T4_CAPE")?.city === "Martlock",
    "gear city",
  );
  assert(
    f.ingredients.find((i) => i.itemId === "T4_RUNE")?.city === "Thetford",
    "rune city",
  );
  assert(f.bmBuy === 30_000, "bm buy");
  assert(upgradeProfit(f.bmBuy, f.cost, 0.04) === 9_200, "profit");
}

// 2) Locked city: all ingredients in Bridgewatch
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Bridgewatch", 1, 11_000, 0),
    row("T4_CAPE", "Martlock", 1, 10_000, 0),
    row("T4_RUNE", "Bridgewatch", 1, 120, 0),
    row("T4_RUNE", "Thetford", 1, 100, 0),
    row("T4_CAPE@1", "Black Market", 1, 0, 30_000),
  ];
  const bw = buildUpgradeFlips(rows, {
    buyCity: "Bridgewatch",
    qualities: [1],
    recipes: [capeRecipe],
  });
  assert(bw.length === 1, "locked bw");
  assert(bw[0].cost === 11_000 + 96 * 120, `bw cost ${bw[0].cost}`);
  assert(
    bw[0].ingredients.every((i) => i.city === "Bridgewatch"),
    "all bw",
  );

  const mart = buildUpgradeFlips(rows, {
    buyCity: "Martlock",
    qualities: [1],
    recipes: [capeRecipe],
  });
  assert(mart.length === 0, "Martlock missing runes");
}

// 3) Quality match + Brecilien + multi-mat path 0→2
{
  const rows: AodpPriceRow[] = [
    row("T5_MAIN_SWORD", "Brecilien", 3, 50_000, 0),
    row("T5_RUNE", "Brecilien", 1, 50, 0),
    row("T5_SOUL", "Brecilien", 1, 80, 0),
    row("T5_MAIN_SWORD@2", "Black Market", 3, 0, 200_000),
    // Wrong quality BM — must not match
    row("T5_MAIN_SWORD@2", "Black Market", 1, 0, 500_000),
  ];
  const flips = buildUpgradeFlips(rows, {
    buyCity: "Brecilien",
    qualities: [3],
    recipes: [multiRecipe],
  });
  assert(flips.length === 1, `q3 flips ${flips.length}`);
  assert(flips[0].quality === 3, "quality");
  assert(flips[0].toEnchant === 2, "to .2");
  assert(
    flips[0].cost === 50_000 + 288 * 50 + 288 * 80,
    `multi cost ${flips[0].cost}`,
  );
  assert(flips[0].bmBuy === 200_000, "q3 bm");
}

// 4) classify: Dual Sickle = weapon; gather gear excluded (no BM)
{
  const dual = classify("T6_2H_DUALSICKLE_UNDEAD");
  assert(dual?.family === "weapon", `dual family ${dual?.family}`);
  assert(dual?.slot === "twoHand", `dual slot ${dual?.slot}`);

  assert(classify("T6_2H_TOOL_SICKLE") === null, "tool excluded");
  assert(classify("T6_ARMOR_GATHERER_ORE") === null, "gatherer armor excluded");
  assert(classify("T6_HEAD_GATHERER_WOOD") === null, "gatherer head excluded");
  assert(classify("T6_BACKPACK_GATHERER_ORE") === null, "gatherer pack excluded");
}

// 5) Built recipes.json has no gather gear
{
  const byBase = new Map<string, { family: string; slot: string }>();
  for (const r of recipesJson as Array<{
    baseId: string;
    family: string;
    slot: string;
  }>) {
    if (!byBase.has(r.baseId)) {
      byBase.set(r.baseId, { family: r.family, slot: r.slot });
    }
  }
  const dual = byBase.get("T6_2H_DUALSICKLE_UNDEAD");
  assert(dual?.family === "weapon", `json dual ${dual?.family}`);
  assert(!byBase.has("T6_ARMOR_GATHERER_ORE"), "json no gatherer");
  assert(!byBase.has("T6_2H_TOOL_SICKLE"), "json no tool");
  assert(
    ![...byBase.values()].some((m) => (m.family as string) === "gather"),
    "no gather family in json",
  );
}

console.log("smoke-upgrade-flips ok");
