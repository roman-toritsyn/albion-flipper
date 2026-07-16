/**
 * Independent audit of craft recipe selection + profitability.
 * Usage: npx tsx scripts/verify-craft-math.ts
 */
import { fetchCraftPrices } from "../lib/aodp";
import { netAfterTax, profit as calcProfit } from "../lib/calc";
import {
  __resetCacheForTests,
  getOrFetchCraftPrices,
} from "../lib/cache";
import {
  CRAFT_RECIPES,
  buildCraftFlipsBoth,
  craftIngredientAllowsQ1Fallback,
  craftPriceItemIds,
  craftProfit,
  type CraftBuyMode,
  type CraftFlipOpportunity,
  type CraftRecipe,
} from "../lib/craftFlips";
import { qualityKey } from "../lib/quality";
import type { AodpPriceRow } from "../lib/types";
import { BLACK_MARKET, CITY_LOCATIONS, ROYAL_CITIES } from "../lib/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const ROYAL = new Set<string>(ROYAL_CITIES);
const CITIES = new Set<string>(CITY_LOCATIONS);

type Sell = { price: number; city: string; date: string };

function indexSells(rows: AodpPriceRow[]) {
  const sells = new Map<string, Map<string, Sell>>(); // qualityKey → city → sell
  const bm = new Map<string, { buy: number; date: string }>();

  for (const row of rows) {
    if (!row.item_id) continue;
    const q = row.quality || 1;
    const key = qualityKey(row.item_id, q);
    if (CITIES.has(row.city) && row.sell_price_min > 0) {
      let byCity = sells.get(key);
      if (!byCity) {
        byCity = new Map();
        sells.set(key, byCity);
      }
      const prev = byCity.get(row.city);
      if (!prev || row.sell_price_min < prev.price) {
        byCity.set(row.city, {
          price: row.sell_price_min,
          city: row.city,
          date: row.sell_price_min_date,
        });
      }
    }
    if (row.city === BLACK_MARKET && row.buy_price_max > 0) {
      bm.set(key, { buy: row.buy_price_max, date: row.buy_price_max_date });
    }
  }
  return { sells, bm };
}

function pickSell(
  sells: Map<string, Map<string, Sell>>,
  itemId: string,
  quality: number,
  mode: CraftBuyMode,
): Sell | null {
  const allowed =
    mode === "royal" ? ROYAL : new Set<string>(["Caerleon"]);

  const atQ = (q: number): Sell | null => {
    const byCity = sells.get(qualityKey(itemId, q));
    if (!byCity) return null;
    let best: Sell | null = null;
    for (const s of byCity.values()) {
      if (!allowed.has(s.city)) continue;
      if (!best || s.price < best.price) best = s;
    }
    return best;
  };

  return atQ(quality) ??
    (quality !== 1 && craftIngredientAllowsQ1Fallback(itemId) ? atQ(1) : null);
}

function recomputeFlip(
  recipe: CraftRecipe,
  quality: number,
  mode: CraftBuyMode,
  sells: Map<string, Map<string, Sell>>,
  bm: Map<string, { buy: number; date: string }>,
): CraftFlipOpportunity | null {
  const out = bm.get(qualityKey(recipe.outputId, quality));
  if (!out) return null;

  let best: {
    cost: number;
    quotes: CraftFlipOpportunity["ingredients"];
    alternativeIndex: number;
  } | null = null;

  for (let i = 0; i < recipe.alternatives.length; i++) {
    const quotes: CraftFlipOpportunity["ingredients"] = [];
    let cost = 0;
    let ok = true;
    for (const ing of recipe.alternatives[i].ingredients) {
      const sell = pickSell(sells, ing.itemId, quality, mode);
      if (!sell) {
        ok = false;
        break;
      }
      const lineTotal = sell.price * ing.count;
      cost += lineTotal;
      quotes.push({
        itemId: ing.itemId,
        count: ing.count,
        unitPrice: sell.price,
        lineTotal,
        date: sell.date,
        city: sell.city,
      });
    }
    if (!ok) continue;
    if (!best || cost < best.cost) best = { cost, quotes, alternativeIndex: i };
  }

  if (!best) return null;
  return {
    outputId: recipe.outputId,
    family: recipe.family,
    quality,
    enchant: recipe.enchant,
    cost: best.cost,
    bmBuy: out.buy,
    bmBuyDate: out.date,
    ingredients: best.quotes,
    alternativeIndex: best.alternativeIndex,
    buyMode: mode,
  };
}

function sameFlip(a: CraftFlipOpportunity, b: CraftFlipOpportunity): boolean {
  if (a.cost !== b.cost || a.bmBuy !== b.bmBuy) return false;
  if (a.alternativeIndex !== b.alternativeIndex) return false;
  if (a.ingredients.length !== b.ingredients.length) return false;
  for (let i = 0; i < a.ingredients.length; i++) {
    const x = a.ingredients[i];
    const y = b.ingredients[i];
    if (
      x.itemId !== y.itemId ||
      x.count !== y.count ||
      x.unitPrice !== y.unitPrice ||
      x.city !== y.city
    ) {
      return false;
    }
  }
  return true;
}

function auditRecipes() {
  assert(CRAFT_RECIPES.length === 575, `recipe count ${CRAFT_RECIPES.length}`);
  for (const r of CRAFT_RECIPES) {
    assert(r.alternatives.length >= 1, `no alts ${r.outputId}`);
    assert(
      r.family === "cape" || r.family === "royal",
      `family ${r.outputId}`,
    );
    if (r.family === "royal") {
      assert(r.alternatives.length === 3, `royal alts ${r.outputId}`);
    }
    for (const alt of r.alternatives) {
      assert(alt.ingredients.length >= 1, `empty alt ${r.outputId}`);
      for (const ing of alt.ingredients) {
        assert(ing.count > 0, `count ${r.outputId} ${ing.itemId}`);
      }
    }
  }
  console.log("recipes structural ok");
}

function auditModes(rows: AodpPriceRow[]) {
  const { sells, bm } = indexSells(rows);
  const { royal, caerleon } = buildCraftFlipsBoth(rows);
  const tax = 0.04;

  for (const [mode, flips] of [
    ["royal", royal],
    ["Caerleon", caerleon],
  ] as const) {
    for (const f of flips) {
      assert(f.buyMode === mode, `buyMode tag ${f.outputId}`);

      // Cities must match mode
      for (const ing of f.ingredients) {
        if (mode === "royal") {
          assert(ROYAL.has(ing.city), `royal used ${ing.city} on ${f.outputId}`);
        } else {
          assert(ing.city === "Caerleon", `caerleon used ${ing.city} on ${f.outputId}`);
        }
      }

      // Cost = sum of lines
      const sum = f.ingredients.reduce((s, i) => s + i.lineTotal, 0);
      assert(Math.abs(sum - f.cost) < 1e-6, `cost sum ${f.outputId}`);

      // Profit matches shared calc
      const p = craftProfit(f.bmBuy, f.cost, tax);
      const expected = calcProfit(f.bmBuy, f.cost, tax);
      assert(p === expected, `profit helper ${f.outputId}`);
      assert(
        Math.abs(p - (netAfterTax(f.bmBuy, tax) - f.cost)) < 1e-6,
        `profit formula ${f.outputId}`,
      );

      // Independent recompute must match
      const recipe = CRAFT_RECIPES.find((r) => r.outputId === f.outputId);
      assert(!!recipe, `recipe missing ${f.outputId}`);
      const recomputed = recomputeFlip(recipe!, f.quality, mode, sells, bm);
      assert(!!recomputed, `recompute null ${f.outputId} q${f.quality}`);
      assert(
        sameFlip(f, recomputed!),
        `mismatch ${mode} ${f.outputId} q${f.quality} cost=${f.cost}/${recomputed!.cost} alt=${f.alternativeIndex}/${recomputed!.alternativeIndex}`,
      );

      // Chosen alt must be cheapest among completable alts
      const costs: number[] = [];
      for (const alt of recipe!.alternatives) {
        let c = 0;
        let ok = true;
        for (const ing of alt.ingredients) {
          const sell = pickSell(sells, ing.itemId, f.quality, mode);
          if (!sell) {
            ok = false;
            break;
          }
          c += sell.price * ing.count;
        }
        if (ok) costs.push(c);
      }
      assert(costs.length > 0, `no completable alt ${f.outputId}`);
      assert(f.cost === Math.min(...costs), `not cheapest alt ${f.outputId}`);
    }
  }

  console.log(
    `mode audit ok: royal=${royal.length} caerleon=${caerleon.length}`,
  );

  // Profitable sample for royal with explicit arithmetic
  const sample = royal
    .map((f) => ({ f, p: craftProfit(f.bmBuy, f.cost, tax) }))
    .filter((x) => x.p >= 10_000)
    .sort((a, b) => b.p - a.p)[0];
  if (sample) {
    const { f, p } = sample;
    console.log(
      `sample royal: ${f.outputId} q${f.quality} cost=${f.cost} bm=${f.bmBuy} tax4%=${Math.round(netAfterTax(f.bmBuy, tax))} profit=${Math.round(p)} alt=${f.alternativeIndex} cities=${[...new Set(f.ingredients.map((i) => i.city))].join("|")}`,
    );
  }

  if (caerleon.length > 0) {
    const c = caerleon[0];
    console.log(
      `sample caerleon: ${c.outputId} q${c.quality} cost=${c.cost} bm=${c.bmBuy} profit=${Math.round(craftProfit(c.bmBuy, c.cost, tax))}`,
    );
  }
}

async function main() {
  auditRecipes();

  // Fixture: force cheapest royal SET alternative
  {
    const recipe = CRAFT_RECIPES.find((r) => r.outputId === "T4_ARMOR_PLATE_ROYAL")!;
    assert(!!recipe && recipe.alternatives.length === 3, "plate royal recipe");
    const rows: AodpPriceRow[] = [
      ...(["SET1", "SET2", "SET3"] as const).flatMap((set, i) => [
        {
          item_id: `T4_ARMOR_PLATE_${set}`,
          city: "Martlock",
          quality: 1,
          sell_price_min: [50_000, 10_000, 30_000][i],
          sell_price_min_date: "2026-07-15T10:00:00",
          sell_price_max: 0,
          sell_price_max_date: "",
          buy_price_min: 0,
          buy_price_min_date: "",
          buy_price_max: 0,
          buy_price_max_date: "",
        } satisfies AodpPriceRow,
      ]),
      {
        item_id: "QUESTITEM_TOKEN_ROYAL_T4",
        city: "Thetford",
        quality: 1,
        sell_price_min: 1_000,
        sell_price_min_date: "2026-07-15T10:00:00",
        sell_price_max: 0,
        sell_price_max_date: "",
        buy_price_min: 0,
        buy_price_min_date: "",
        buy_price_max: 0,
        buy_price_max_date: "",
      },
      {
        item_id: "T4_ARMOR_PLATE_ROYAL",
        city: "Black Market",
        quality: 1,
        sell_price_min: 0,
        sell_price_min_date: "",
        sell_price_max: 0,
        sell_price_max_date: "",
        buy_price_min: 0,
        buy_price_min_date: "",
        buy_price_max: 40_000,
        buy_price_max_date: "2026-07-15T10:00:00",
      },
    ];
    const { royal, caerleon } = buildCraftFlipsBoth(rows, [recipe], [1]);
    assert(royal.length === 1, "fixture royal");
    assert(royal[0].alternativeIndex === 1, "must pick SET2");
    assert(royal[0].cost === 14_000, `cost ${royal[0].cost}`); // 10k + 4*1k
    assert(caerleon.length === 0, "fixture caerleon empty");
    const p = craftProfit(40_000, 14_000, 0.04);
    assert(p === 24_400, `profit ${p}`); // 40000*0.96 - 14000
    console.log("fixture alternative+profit ok");
  }

  __resetCacheForTests();
  const ids = craftPriceItemIds();
  const { data } = await getOrFetchCraftPrices(ids, (missing) => fetchCraftPrices(missing));
  auditModes(data);
  console.log("verify-craft-math ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
