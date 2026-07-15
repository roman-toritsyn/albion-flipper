import { fetchEuropePrices } from "../lib/aodp";
import { ageMinutes } from "../lib/calc";

async function main() {
  const items = [
    "T4_BAG@3",
    "T5_BAG",
    "T6_MAIN_SWORD@3",
    "T7_ARMOR_CLOTH_SET1@1",
    "T8_CAPE",
    "T6_BAG@3",
    "T5_MAIN_SWORD@2",
  ];
  const rows = await fetchEuropePrices(items);
  const now = Date.now();
  console.log("now UTC", new Date(now).toISOString());
  console.log("tz offset min", -new Date().getTimezoneOffset());

  type Row = {
    city: string;
    item: string;
    field: string;
    raw: string;
    ageLocal: number;
    ageAsUtc: number;
  };
  const ages: Row[] = [];

  for (const r of rows) {
    for (const [field, raw] of [
      ["buy", r.buy_price_max_date],
      ["sell", r.sell_price_min_date],
    ] as const) {
      if (!raw || raw.startsWith("0001")) continue;
      const asUtc = Date.parse(raw.endsWith("Z") || /[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
      ages.push({
        city: r.city,
        item: r.item_id,
        field,
        raw,
        ageLocal: Math.round(ageMinutes(raw, now)),
        ageAsUtc: Math.round((now - asUtc) / 60_000),
      });
    }
  }

  const bm = ages
    .filter((a) => a.city === "Black Market" && a.field === "buy")
    .sort((a, b) => a.ageLocal - b.ageLocal);
  const citySell = ages
    .filter((a) => a.city !== "Black Market" && a.field === "sell")
    .sort((a, b) => a.ageLocal - b.ageLocal);

  console.log("freshest BM buy timestamps:");
  console.log(bm.slice(0, 10));
  console.log("freshest city sell timestamps:");
  console.log(citySell.slice(0, 10));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
