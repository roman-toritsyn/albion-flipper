/**
 * Fixture smoke for buildCraftFlips buy modes / cities (no network).
 * Usage: npx tsx scripts/smoke-craft-flips.ts
 */
import {
  buildCraftFlips,
  buildCraftFlipsByMode,
  craftProfit,
  type CraftRecipe,
} from "../lib/craftFlips";
import type { AodpPriceRow } from "../lib/types";

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

const demonRecipe: CraftRecipe = {
  outputId: "T4_CAPEITEM_DEMON",
  enchant: 0,
  family: "cape",
  alternatives: [
    {
      ingredients: [
        { itemId: "T4_CAPE", count: 1 },
        { itemId: "T4_CAPEITEM_DEMON_BP", count: 1 },
        { itemId: "T1_FACTION_STEPPE_TOKEN_1", count: 1 },
      ],
    },
  ],
};

const royalRecipe: CraftRecipe = {
  outputId: "T4_ARMOR_PLATE_ROYAL",
  enchant: 0,
  family: "royal",
  alternatives: [
    {
      ingredients: [
        { itemId: "T4_ARMOR_PLATE_SET1", count: 1 },
        { itemId: "QUESTITEM_TOKEN_ROYAL_T4", count: 4 },
      ],
    },
    {
      ingredients: [
        { itemId: "T4_ARMOR_PLATE_SET2", count: 1 },
        { itemId: "QUESTITEM_TOKEN_ROYAL_T4", count: 4 },
      ],
    },
    {
      ingredients: [
        { itemId: "T4_ARMOR_PLATE_SET3", count: 1 },
        { itemId: "QUESTITEM_TOKEN_ROYAL_T4", count: 4 },
      ],
    },
  ],
};

// 1) Demon — royal buy mode (cheapest among royals)
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Martlock", 1, 10_000, 0),
    row("T4_CAPE", "Bridgewatch", 1, 12_000, 0),
    row("T4_CAPEITEM_DEMON_BP", "Thetford", 1, 20_000, 0),
    row("T1_FACTION_STEPPE_TOKEN_1", "Lymhurst", 1, 5_000, 0),
    row("T4_CAPEITEM_DEMON", "Black Market", 1, 0, 50_000),
  ];
  const flips = buildCraftFlips(rows, [demonRecipe], [1], "royal");
  assert(flips.length === 1, `expected 1 demon flip, got ${flips.length}`);
  const f = flips[0];
  assert(f.cost === 35_000, `cost ${f.cost}`);
  assert(f.buyMode === "royal", "buyMode royal");
  assert(
    f.ingredients.find((i) => i.itemId === "T4_CAPE")?.city === "Martlock",
    "cape city",
  );
  assert(craftProfit(f.bmBuy, f.cost, 0.04) === 13_000, "profit");
}

// 2) Bridgewatch-only: complete set in Bridgewatch
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Bridgewatch", 1, 11_000, 0),
    row("T4_CAPE", "Martlock", 1, 10_000, 0),
    row("T4_CAPEITEM_DEMON_BP", "Bridgewatch", 1, 21_000, 0),
    row("T1_FACTION_STEPPE_TOKEN_1", "Bridgewatch", 1, 6_000, 0),
    row("T4_CAPEITEM_DEMON", "Black Market", 1, 0, 50_000),
  ];
  const bw = buildCraftFlips(rows, [demonRecipe], [1], "Bridgewatch");
  assert(bw.length === 1, "Bridgewatch flip");
  assert(bw[0].cost === 38_000, `bw cost ${bw[0].cost}`);
  assert(bw[0].ingredients.every((i) => i.city === "Bridgewatch"), "all BW");
  assert(craftProfit(50_000, 38_000, 0.04) === 10_000, "bw profit");

  const mart = buildCraftFlips(rows, [demonRecipe], [1], "Martlock");
  assert(mart.length === 0, "Martlock missing BP/token");
}

// 3) Martlock-only → royal yes, Caerleon no
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Martlock", 1, 10_000, 0),
    row("T4_CAPEITEM_DEMON_BP", "Martlock", 1, 20_000, 0),
    row("T1_FACTION_STEPPE_TOKEN_1", "Martlock", 1, 5_000, 0),
    row("T4_CAPEITEM_DEMON", "Black Market", 1, 0, 50_000),
  ];
  const by = buildCraftFlipsByMode(rows, [demonRecipe], [1]);
  assert(by.royal.length === 1, "royal should have flip");
  assert(by.Martlock.length === 1, "Martlock city flip");
  assert(by.Caerleon.length === 0, "Caerleon empty");
  assert(by.Bridgewatch.length === 0, "Bridgewatch empty");
}

// 4) Caerleon-only prices
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Caerleon", 1, 10_000, 0),
    row("T4_CAPEITEM_DEMON_BP", "Caerleon", 1, 20_000, 0),
    row("T1_FACTION_STEPPE_TOKEN_1", "Caerleon", 1, 5_000, 0),
    row("T4_CAPEITEM_DEMON", "Black Market", 1, 0, 50_000),
  ];
  const by = buildCraftFlipsByMode(rows, [demonRecipe], [1]);
  assert(by.Caerleon.length === 1, "Caerleon flip");
  assert(by.royal.length === 0, "royal skip");
}

// 5) Royal SET cheapest among royals; Bridgewatch incomplete
{
  const rows: AodpPriceRow[] = [
    row("T4_ARMOR_PLATE_SET2", "Caerleon", 1, 20_000, 0),
    row("T4_ARMOR_PLATE_SET2", "Martlock", 1, 22_000, 0),
    row("QUESTITEM_TOKEN_ROYAL_T4", "Martlock", 1, 5_000, 0),
    row("T4_ARMOR_PLATE_ROYAL", "Black Market", 1, 0, 80_000),
  ];
  const royal = buildCraftFlips(rows, [royalRecipe], [1], "royal");
  assert(royal.length === 1, "royal flip");
  assert(royal[0].cost === 42_000, `royal cost ${royal[0].cost}`);
  assert(buildCraftFlips(rows, [royalRecipe], [1], "Caerleon").length === 0, "caer skip");
  assert(buildCraftFlips(rows, [royalRecipe], [1], "Bridgewatch").length === 0, "bw skip");
}

// 6) No BM
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Martlock", 1, 10_000, 0),
    row("T4_CAPEITEM_DEMON_BP", "Martlock", 1, 20_000, 0),
    row("T1_FACTION_STEPPE_TOKEN_1", "Martlock", 1, 5_000, 0),
  ];
  const by = buildCraftFlipsByMode(rows, [demonRecipe], [1]);
  assert(by.royal.length === 0 && by.Martlock.length === 0, "no BM");
}

// 7) Gear must match quality — Q1 cape must NOT price a Q5 craft
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Martlock", 1, 10_000, 0),
    row("T4_CAPEITEM_DEMON_BP", "Martlock", 1, 20_000, 0),
    row("T1_FACTION_STEPPE_TOKEN_1", "Martlock", 1, 5_000, 0),
    row("T4_CAPEITEM_DEMON", "Black Market", 5, 0, 200_000),
  ];
  const q5 = buildCraftFlips(rows, [demonRecipe], [5], "royal");
  assert(q5.length === 0, "Q5 must not use Q1 cape");
}

// 8) Tokens/BP may fall back to Q1; gear must be exact quality
{
  const rows: AodpPriceRow[] = [
    row("T4_CAPE", "Martlock", 5, 80_000, 0),
    row("T4_CAPEITEM_DEMON_BP", "Martlock", 1, 20_000, 0),
    row("T1_FACTION_STEPPE_TOKEN_1", "Martlock", 1, 5_000, 0),
    row("T4_CAPEITEM_DEMON", "Black Market", 5, 0, 200_000),
  ];
  const q5 = buildCraftFlips(rows, [demonRecipe], [5], "royal");
  assert(q5.length === 1, "Q5 with Q5 cape + Q1 BP/token");
  assert(q5[0].cost === 105_000, `q5 cost ${q5[0].cost}`);
  assert(
    q5[0].ingredients.find((i) => i.itemId === "T4_CAPE")?.unitPrice === 80_000,
    "cape at Q5",
  );
}

// 9) Royal SET gear: Q1 SET must not price Q5 royal craft
{
  const rows: AodpPriceRow[] = [
    row("T4_ARMOR_PLATE_SET2", "Martlock", 1, 22_000, 0),
    row("QUESTITEM_TOKEN_ROYAL_T4", "Martlock", 1, 5_000, 0),
    row("T4_ARMOR_PLATE_ROYAL", "Black Market", 5, 0, 200_000),
  ];
  assert(
    buildCraftFlips(rows, [royalRecipe], [5], "royal").length === 0,
    "Q5 royal must not use Q1 SET",
  );
}

console.log("smoke-craft-flips ok");
