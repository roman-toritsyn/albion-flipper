/**
 * Fixture smoke for refine flips (no network).
 * Usage: npx tsx scripts/smoke-refine-flips.ts
 */
import {
  buildRefineFlips,
  refineProfit,
  type RefineRecipe,
} from "../lib/refineFlips";
import { resourceReturnRate, specialtyCityFor } from "../lib/refineRates";
import type { AodpPriceRow } from "../lib/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function row(
  item_id: string,
  city: string,
  sell_price_min: number,
  buy_price_max: number,
): AodpPriceRow {
  return {
    item_id,
    city,
    quality: 1,
    sell_price_min,
    sell_price_min_date: "2026-07-15T12:00:00",
    sell_price_max: 0,
    sell_price_max_date: "",
    buy_price_min: 0,
    buy_price_min_date: "",
    buy_price_max,
    buy_price_max_date: "2026-07-15T12:00:00",
  };
}

assert(specialtyCityFor("bars") === "Thetford", "specialty bars");
assert(
  Math.abs(resourceReturnRate("bars", "Thetford", false) - 0.367) < 5e-4,
  "RRR specialty",
);
assert(
  Math.abs(resourceReturnRate("bars", "Martlock", false) - 0.153) < 5e-4,
  "RRR base",
);
assert(
  Math.abs(resourceReturnRate("bars", "Brecilien", false) - 0.153) < 5e-4,
  "RRR Brecilien base",
);
assert(
  Math.abs(resourceReturnRate("cloth", "Brecilien", true) - 0.435) < 5e-4,
  "RRR Brecilien focus",
);
assert(
  Math.abs(resourceReturnRate("bars", "Thetford", false, 10) - 0.405) < 5e-4,
  "RRR specialty +10 daily",
);
assert(
  Math.abs(resourceReturnRate("bars", "Thetford", false, 20) - 0.438) < 5e-4,
  "RRR specialty +20 daily",
);
assert(
  Math.abs(resourceReturnRate("bars", "Thetford", true, 20) - 0.578) < 5e-4,
  "RRR specialty focus +20 daily",
);

const recipe: RefineRecipe = {
  outputId: "T5_METALBAR",
  enchant: 0,
  tier: 5,
  family: "bars",
  alternatives: [
    {
      ingredients: [
        { itemId: "T5_ORE", count: 3 },
        { itemId: "T4_METALBAR", count: 1 },
      ],
    },
  ],
};

const rows: AodpPriceRow[] = [
  row("T5_ORE", "Thetford", 100, 80),
  row("T5_ORE", "Martlock", 90, 70),
  row("T4_METALBAR", "Lymhurst", 500, 400),
  row("T5_METALBAR", "Bridgewatch", 1000, 900),
  row("T5_METALBAR", "Caerleon", 1100, 950),
];

{
  const flips = buildRefineFlips(rows, [recipe], {
    buySide: "instant",
    sellSide: "instant",
    useFocus: false,
  });
  assert(flips.length === 1, `expected 1, got ${flips.length}`);
  const f = flips[0];
  // buy ore Martlock 90*3 + bar Lymhurst 500 = 770
  assert(f.grossCost === 770, `gross ${f.grossCost}`);
  assert(f.refineCity === "Thetford", "refine city");
  assert(Math.abs(f.effectiveCost - 770 * (1 - f.rrr)) < 1e-6, "effective");
  // sell prefers refine city (Thetford) when quote exists — none here → fall back best
  // Caerleon ignored for refine → Bridgewatch bid 900
  assert(f.revenue === 900, `revenue ${f.revenue}`);
  assert(f.revenueCity === "Bridgewatch", "sell city fallback");
  const p = refineProfit(f.revenue, f.effectiveCost, 0.04);
  assert(Number.isFinite(p), "profit");
}

{
  const flips = buildRefineFlips(rows, [recipe], {
    buySide: "order",
    sellSide: "order",
    useFocus: false,
  });
  const f = flips[0];
  // buy order: ore Martlock 70*3 + bar Lymhurst 400 = 610
  assert(f.grossCost === 610, `order gross ${f.grossCost}`);
  // sell order falls back to Bridgewatch ask 1000 (Caerleon ignored)
  assert(f.revenue === 1000, `order revenue ${f.revenue}`);
  assert(f.revenueCity === "Bridgewatch", "order sell city");
}

{
  // When refine city has a sell quote, use it even if another city is higher.
  const withLocal: AodpPriceRow[] = [
    ...rows,
    row("T5_METALBAR", "Thetford", 800, 700),
  ];
  const flips = buildRefineFlips(withLocal, [recipe], {
    buySide: "instant",
    sellSide: "order",
    useFocus: false,
  });
  const f = flips[0];
  assert(f.revenue === 800, `local sell ${f.revenue}`);
  assert(f.revenueCity === "Thetford", "sell in refine city");
}

{
  // Focus raises RRR → lower effective cost
  const noFocus = buildRefineFlips(rows, [recipe], {
    buySide: "instant",
    sellSide: "order",
    useFocus: false,
  })[0];
  const focused = buildRefineFlips(rows, [recipe], {
    buySide: "instant",
    sellSide: "order",
    useFocus: true,
  })[0];
  assert(focused.rrr > noFocus.rrr, "focus rrr");
  assert(focused.effectiveCost < noFocus.effectiveCost, "focus cheaper");
}

{
  // Stale cheap buy-order must be skipped in favor of fresher quote.
  const staleRows: AodpPriceRow[] = rows.map((r) => {
    if (r.item_id === "T5_ORE" && r.city === "Martlock") {
      return {
        ...r,
        sell_price_min: 200,
        sell_price_min_date: "2026-07-15T12:00:00",
        buy_price_max: 50,
        buy_price_max_date: "2026-07-01T12:00:00",
      };
    }
    return r;
  });
  const flips = buildRefineFlips(staleRows, [recipe], {
    buySide: "order",
    sellSide: "order",
    useFocus: false,
    maxAgeMinutes: 360,
    nowMs: Date.parse("2026-07-15T12:00:00Z"),
  });
  const f = flips[0];
  assert(!!f, "freshness flip");
  const ore = f.ingredients.find((i) => i.itemId === "T5_ORE");
  assert(!!ore, "ore quote");
  // Martlock bid 50 is stale → Thetford bid 80
  assert(ore!.city === "Thetford", `city ${ore!.city}`);
  assert(ore!.unitPrice === 80, `price ${ore!.unitPrice}`);
}

console.log("smoke-refine-flips ok");
