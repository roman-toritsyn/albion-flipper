import { buildFlips } from "../lib/flips";
import type { AodpPriceRow } from "../lib/types";

function base(
  partial: Partial<AodpPriceRow> & Pick<AodpPriceRow, "item_id" | "city">,
): AodpPriceRow {
  return {
    quality: 1,
    sell_price_min: 0,
    sell_price_min_date: "2026-07-14T00:00:00",
    sell_price_max: 0,
    sell_price_max_date: "2026-07-14T00:00:00",
    buy_price_min: 0,
    buy_price_min_date: "2026-07-14T00:00:00",
    buy_price_max: 0,
    buy_price_max_date: "2026-07-14T00:00:00",
    ...partial,
  };
}

const rows: AodpPriceRow[] = [
  base({
    item_id: "T6_BAG@3",
    city: "Black Market",
    quality: 1,
    buy_price_max: 100000,
    buy_price_max_date: "2026-07-14T12:00:00",
  }),
  base({
    item_id: "T6_BAG@3",
    city: "Caerleon",
    quality: 1,
    sell_price_min: 80000,
    sell_price_min_date: "2026-07-14T12:00:00",
  }),
  base({
    item_id: "T6_BAG@3",
    city: "Lymhurst",
    quality: 1,
    sell_price_min: 90000,
    sell_price_min_date: "2026-07-14T12:00:00",
  }),
  // Masterpiece BM must NOT pair with Normal city sell
  base({
    item_id: "T6_BAG@3",
    city: "Black Market",
    quality: 5,
    buy_price_max: 500000,
    buy_price_max_date: "2026-07-14T12:00:00",
  }),
  base({
    item_id: "T6_BAG@3",
    city: "Thetford",
    quality: 5,
    sell_price_min: 400000,
    sell_price_min_date: "2026-07-14T12:00:00",
  }),
  base({
    item_id: "T6_BAG@3",
    city: "Martlock",
    quality: 1,
    sell_price_min: 0,
  }),
];

const flips = buildFlips(rows);
if (flips.length !== 3) throw new Error(`expected 3 flips got ${flips.length}`);

const q1 = flips.filter((f) => f.quality === 1);
const q5 = flips.filter((f) => f.quality === 5);
if (q1.length !== 2) throw new Error(`q1 expected 2 got ${q1.length}`);
if (q5.length !== 1) throw new Error(`q5 expected 1 got ${q5.length}`);
if (q5[0].city !== "Thetford" || q5[0].bmBuy !== 500000) {
  throw new Error("q5 mismatch");
}
// Ensure no cross: Normal city vs Masterpiece BM
const bad = flips.find((f) => f.quality === 5 && f.citySell === 80000);
if (bad) throw new Error("cross-quality flip leaked");

console.log("flips builder OK (quality-aware)");
