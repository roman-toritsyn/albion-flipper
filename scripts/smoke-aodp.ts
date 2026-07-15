import { buildPricesUrl, chunkItemIds, fetchEuropePrices } from "../lib/aodp";

async function main() {
  const sample = [
    "T4_BAG@3",
    "T5_BAG",
    "T6_MAIN_SWORD@3",
    "T7_ARMOR_PLATE_SET1@2",
    "T8_CAPE@1",
  ];

  const url = buildPricesUrl(sample);
  console.log("urlLen", url.length);
  if (url.length > 4096) throw new Error("url too long");

  const rows = await fetchEuropePrices(sample);
  console.log("rows", rows.length);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("empty response");

  const r = rows[0];
  for (const k of [
    "item_id",
    "city",
    "sell_price_min",
    "buy_price_max",
    "sell_price_min_date",
    "buy_price_max_date",
  ] as const) {
    if (!(k in r)) throw new Error(`missing ${k}`);
  }

  console.log(
    "cities",
    [...new Set(rows.map((x) => x.city))].sort().join(", "),
  );
  console.log("sample", {
    item: r.item_id,
    city: r.city,
    sell: r.sell_price_min,
    buy: r.buy_price_max,
  });

  const uniqueIds = [
    ...sample,
    ...Array.from({ length: 120 }, (_, i) => {
      const e = i % 5;
      return e === 0 ? "T5_MAIN_SWORD" : `T5_MAIN_SWORD@${e}`;
    }),
  ];
  const chunks = chunkItemIds([...new Set(uniqueIds)]);
  for (const c of chunks) {
    const u = buildPricesUrl(c);
    if (u.length > 4096) throw new Error(`chunk url overflow ${u.length}`);
  }
  console.log("aodp OK chunks", chunks.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
