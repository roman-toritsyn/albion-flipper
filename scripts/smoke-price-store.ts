/**
 * Fixture smoke for lib/priceStore (no network, no API wiring).
 * Usage: npx tsx scripts/smoke-price-store.ts
 */
import { FRESH_COOLDOWN_MS, CACHE_TTL_MS } from "../lib/constants";
import {
  __resetPriceStoresForTests,
  ensureBrecilienPrices,
  ensureCityBmPrices,
} from "../lib/priceStore";
import type { AodpPriceRow } from "../lib/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function row(item_id: string, city: string, sell: number): AodpPriceRow {
  return {
    item_id,
    city,
    quality: 1,
    sell_price_min: sell,
    sell_price_min_date: "2026-07-15T10:00:00",
    sell_price_max: 0,
    sell_price_max_date: "",
    buy_price_min: 0,
    buy_price_min_date: "",
    buy_price_max: 0,
    buy_price_max_date: "",
  };
}

async function main() {
  __resetPriceStoresForTests();
  let calls = 0;
  const fetchedIds: string[][] = [];

  const fetchMissing = async (missing: string[]) => {
    calls += 1;
    fetchedIds.push([...missing].sort());
    await new Promise((r) => setTimeout(r, 20));
    return missing.flatMap((id) => [
      row(id, "Caerleon", 100),
      row(id, "Black Market", 0),
    ]);
  };

  // 1) cold miss → fetch
  const a = await ensureCityBmPrices(["A"], fetchMissing);
  assert(a.cacheHit === false && calls === 1, `1st hit=${a.cacheHit} calls=${calls}`);
  assert(a.data.length === 2, `1st rows ${a.data.length}`);
  assert(a.data.every((r) => r.item_id === "A"), "only A");

  // 2) full hit → no fetch
  const b = await ensureCityBmPrices(["A"], fetchMissing);
  assert(b.cacheHit === true && calls === 1, `2nd hit=${b.cacheHit} calls=${calls}`);

  // 3) missing-only: need A+B → fetch only B
  const c = await ensureCityBmPrices(["A", "B"], fetchMissing);
  assert(c.cacheHit === false && calls === 2, `missing hit=${c.cacheHit} calls=${calls}`);
  assert(fetchedIds[1].join() === "B", `missing ids ${fetchedIds[1]}`);
  assert(c.data.filter((r) => r.item_id === "A").length === 2, "A present");
  assert(c.data.filter((r) => r.item_id === "B").length === 2, "B present");
  assert(c.data.length === 4, `combined ${c.data.length}`);

  // 4) return only neededIds (store has A,B; ask A)
  const d = await ensureCityBmPrices(["A"], fetchMissing);
  assert(d.cacheHit === true && d.data.every((r) => r.item_id === "A"), "filter needed");
  assert(d.data.length === 2, "A only length");

  // 5) coalesce parallel identical ensures
  __resetPriceStoresForTests();
  calls = 0;
  const [p1, p2] = await Promise.all([
    ensureCityBmPrices(["X"], fetchMissing),
    ensureCityBmPrices(["X"], fetchMissing),
  ]);
  assert(calls === 1, `coalesce calls=${calls}`);
  assert(p1.data.length === 2 && p2.data.length === 2, "coalesce rows");

  // 6) fresh within cooldown → no refetch
  const within = await ensureCityBmPrices(["X"], fetchMissing, { fresh: true });
  assert(within.cacheHit === true && calls === 1, `fresh cooldown calls=${calls}`);

  // 7) fresh after cooldown → full clear + refetch
  __resetPriceStoresForTests();
  calls = 0;
  const t0 = Date.now();
  await ensureCityBmPrices(["Y"], fetchMissing, { now: t0 });
  assert(calls === 1, "seed");
  const forced = await ensureCityBmPrices(["Y"], fetchMissing, {
    fresh: true,
    now: t0 + FRESH_COOLDOWN_MS + 1_000,
  });
  assert(forced.cacheHit === false && calls === 2, `fresh after cd calls=${calls}`);

  // 8) TTL expiry → refetch
  __resetPriceStoresForTests();
  calls = 0;
  await ensureCityBmPrices(["Z"], fetchMissing, { now: t0 });
  const expired = await ensureCityBmPrices(["Z"], fetchMissing, {
    now: t0 + CACHE_TTL_MS + 1,
  });
  assert(expired.cacheHit === false && calls === 2, `ttl calls=${calls}`);

  // 9) Brecilien store is independent
  __resetPriceStoresForTests();
  calls = 0;
  await ensureCityBmPrices(["R"], fetchMissing);
  const brecFetch = async (missing: string[]) => {
    calls += 1;
    return missing.map((id) => row(id, "Brecilien", 50));
  };
  const br = await ensureBrecilienPrices(["R"], brecFetch);
  assert(br.cacheHit === false && calls === 2, "brec separate fetch");
  assert(br.data.every((r) => r.city === "Brecilien"), "brec city");
  // city+BM still hit
  const cityAgain = await ensureCityBmPrices(["R"], fetchMissing);
  assert(cityAgain.cacheHit === true, "city bm still warm");

  console.log("smoke-price-store ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
