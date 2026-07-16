/**
 * Fixture smoke for refine flips (no network).
 * Usage: npx tsx scripts/smoke-refine-flips.ts
 */
import {
  buildRefineFlips,
  calcManualRefine,
  refineProfit,
  type RefineRecipe,
} from "../lib/refineFlips";
import { resourceReturnRate, specialtyCityFor } from "../lib/refineRates";
import {
  refineItemValue,
  refineNutrition,
  refineStationFee,
} from "../lib/refineStationFee";
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

{
  // Station fee: nutrition × (usageFee / 100); T2 free.
  assert(refineItemValue(4, 0) === 16, "IV T4.0");
  assert(refineItemValue(5, 0) === 32, "IV T5.0");
  assert(refineItemValue(5, 2) === 128, "IV T5.2");
  assert(refineItemValue(8, 3) === 2048, "IV T8.3");
  assert(refineItemValue(2, 0) === 0, "IV T2 free");
  assert(Math.abs(refineNutrition(4, 0) - 1.8) < 1e-9, "nutrition T4");
  assert(Math.abs(refineStationFee(4, 0, 1000) - 18) < 1e-9, "fee T4@1000");
  assert(Math.abs(refineStationFee(5, 0, 1000) - 36) < 1e-9, "fee T5@1000");
  assert(Math.abs(refineStationFee(5, 2, 1000) - 144) < 1e-9, "fee T5.2@1000");
  assert(Math.abs(refineStationFee(8, 3, 1000) - 2304) < 1e-9, "fee T8.3@1000");
  assert(refineStationFee(2, 0, 9999) === 0, "fee T2 zero");
  assert(refineStationFee(5, 0, 0) === 0, "fee zero usage");
}

{
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
  const manual = calcManualRefine({
    recipe,
    unitPrices: { T5_ORE: 100, T4_METALBAR: 500 },
    sellPrice: 1000,
    useFocus: false,
    dailyBonus: 0,
    taxRate: 0.04,
  });
  assert(!!manual, "manual result");
  assert(manual!.grossCost === 800, `manual gross ${manual!.grossCost}`);
  assert(manual!.complete, "manual complete");
  assert(manual!.stationFee === 0, "manual fee default 0");
  assert(manual!.profit === refineProfit(1000, manual!.effectiveCost, 0.04), "manual profit");

  const withFee = calcManualRefine({
    recipe,
    unitPrices: { T5_ORE: 100, T4_METALBAR: 500 },
    sellPrice: 1000,
    useFocus: false,
    dailyBonus: 0,
    taxRate: 0.04,
    stationFeePer100: 1000,
  });
  assert(!!withFee, "manual fee result");
  assert(Math.abs(withFee!.stationFee - 36) < 1e-9, `manual fee ${withFee!.stationFee}`);
  assert(
    Math.abs(withFee!.profit - (manual!.profit - 36)) < 1e-6,
    "manual profit minus fee",
  );
  // RRR scales mats only — fee stays fixed
  const focusedFee = calcManualRefine({
    recipe,
    unitPrices: { T5_ORE: 100, T4_METALBAR: 500 },
    sellPrice: 1000,
    useFocus: true,
    dailyBonus: 0,
    taxRate: 0.04,
    stationFeePer100: 1000,
  });
  assert(!!focusedFee, "focused fee");
  assert(Math.abs(focusedFee!.stationFee - 36) < 1e-9, "fee ignore RRR");
  assert(focusedFee!.effectiveCost < withFee!.effectiveCost, "focus mats cheaper");
}

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
  assert(f.stationFee === 0, "default station fee 0");
  // sell prefers refine city (Thetford) when quote exists — none here → fall back best
  // Caerleon ignored for refine → Bridgewatch bid 900
  assert(f.revenue === 900, `revenue ${f.revenue}`);
  assert(f.revenueCity === "Bridgewatch", "sell city fallback");
  const p = refineProfit(f.revenue, f.effectiveCost, 0.04);
  assert(Number.isFinite(p), "profit");
}

{
  const withFee = buildRefineFlips(rows, [recipe], {
    buySide: "instant",
    sellSide: "instant",
    useFocus: false,
    stationFeePer100: 1000,
  })[0];
  const noFee = buildRefineFlips(rows, [recipe], {
    buySide: "instant",
    sellSide: "instant",
    useFocus: false,
    stationFeePer100: 0,
  })[0];
  assert(Math.abs(withFee.stationFee - 36) < 1e-9, `flip fee ${withFee.stationFee}`);
  assert(
    Math.abs(
      refineProfit(withFee.revenue, withFee.effectiveCost, 0.04, withFee.stationFee) -
        (refineProfit(noFee.revenue, noFee.effectiveCost, 0.04) - 36),
    ) < 1e-6,
    "flip profit accounts for fee",
  );
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

{
  // AODP lists enchanted resources as UniqueName_LEVELn@n — index must match recipes.
  const enchRecipe: RefineRecipe = {
    outputId: "T8_PLANKS_LEVEL2",
    enchant: 2,
    tier: 8,
    family: "planks",
    alternatives: [
      {
        ingredients: [
          { itemId: "T8_WOOD_LEVEL2", count: 5 },
          { itemId: "T7_PLANKS_LEVEL2", count: 1 },
        ],
      },
    ],
  };
  const enchRows: AodpPriceRow[] = [
    row("T8_WOOD_LEVEL2@2", "Fort Sterling", 5000, 4800),
    row("T7_PLANKS_LEVEL2@2", "Fort Sterling", 20000, 19000),
    row("T8_PLANKS_LEVEL2@2", "Fort Sterling", 50000, 45000),
  ];
  const flips = buildRefineFlips(enchRows, [enchRecipe], {
    buySide: "instant",
    sellSide: "order",
    useFocus: true,
    stationFeePer100: 1000,
  });
  assert(flips.length === 1, "enchanted flip");
  assert(flips[0].revenue === 50000, `ench revenue ${flips[0].revenue}`);
  assert(
    flips[0].ingredients.every((i) => i.unitPrice > 0),
    "ench ingredients",
  );
  // T8.2: 16 * 2^(8-4) * 2^2 = 16 * 16 * 4 = 1024 IV → fee = 1024 * 1.125 = 1152
  assert(Math.abs(flips[0].stationFee - 1152) < 1e-6, `ench fee ${flips[0].stationFee}`);
}

{
  // Ghost buy-order: bid << ask must not be used as "cheap refine input".
  const ghostRecipe: RefineRecipe = {
    outputId: "T6_PLANKS_LEVEL2",
    enchant: 2,
    tier: 6,
    family: "planks",
    alternatives: [
      {
        ingredients: [
          { itemId: "T6_WOOD_LEVEL2", count: 4 },
          { itemId: "T5_PLANKS_LEVEL2", count: 1 },
        ],
      },
    ],
  };
  const ghostRows: AodpPriceRow[] = [
    row("T6_WOOD_LEVEL2", "Thetford", 6400, 6000),
    row("T5_PLANKS_LEVEL2", "Brecilien", 5500, 2498), // ghost: bid << ask
    row("T5_PLANKS_LEVEL2", "Lymhurst", 0, 3700), // ghost: bid without ask
    row("T5_PLANKS_LEVEL2", "Martlock", 5000, 4500), // realistic
    row("T6_PLANKS_LEVEL2", "Fort Sterling", 21000, 20000),
  ];
  const flips = buildRefineFlips(ghostRows, [ghostRecipe], {
    buySide: "order",
    sellSide: "order",
    useFocus: false,
  });
  assert(flips.length === 1, "ghost: flip exists");
  const plank = flips[0].ingredients.find((i) => i.itemId === "T5_PLANKS_LEVEL2");
  assert(!!plank, "ghost: plank");
  assert(plank!.city === "Martlock", `ghost city ${plank!.city}`);
  assert(plank!.unitPrice === 4500, `ghost price ${plank!.unitPrice}`);
}

console.log("smoke-refine-flips ok");
