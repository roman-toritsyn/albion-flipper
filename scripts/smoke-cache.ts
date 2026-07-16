import { __resetCacheForTests, getOrFetchPrices } from "../lib/cache";
import { FRESH_COOLDOWN_MS } from "../lib/constants";
import type { AodpPriceRow } from "../lib/types";

function row(item_id = "T5_BAG"): AodpPriceRow {
  return {
    item_id,
    city: "Caerleon",
    quality: 1,
    sell_price_min: 1,
    sell_price_min_date: new Date().toISOString(),
    sell_price_max: 1,
    sell_price_max_date: new Date().toISOString(),
    buy_price_min: 1,
    buy_price_min_date: new Date().toISOString(),
    buy_price_max: 1,
    buy_price_max_date: new Date().toISOString(),
  };
}

function assertEq(actual: number, expected: number, msg: string): void {
  if (actual !== expected) throw new Error(`${msg}: got ${actual} want ${expected}`);
}

async function main() {
  __resetCacheForTests();
  const state = { calls: 0 };
  const fetchedBatches: string[][] = [];
  const fetchMissing = async (missing: string[]) => {
    state.calls += 1;
    fetchedBatches.push([...missing].sort());
    await new Promise((r) => setTimeout(r, 30));
    return missing.map((id) => row(id));
  };

  const a = await getOrFetchPrices(["T5_BAG"], fetchMissing);
  if (a.cacheHit !== false) throw new Error(`1st: hit=${a.cacheHit}`);
  assertEq(state.calls, 1, "1st calls");

  const b = await getOrFetchPrices(["T5_BAG"], fetchMissing);
  if (b.cacheHit !== true) throw new Error(`2nd: hit=${b.cacheHit}`);
  assertEq(state.calls, 1, "2nd calls");

  // Different id set shares store: only fetch the new id
  const c = await getOrFetchPrices(["T5_BAG", "T6_BAG"], fetchMissing);
  if (c.cacheHit !== false) throw new Error(`missing-only: hit=${c.cacheHit}`);
  assertEq(state.calls, 2, "missing-only calls");
  if (fetchedBatches[1].join() !== "T6_BAG") {
    throw new Error(`expected only T6_BAG, got ${fetchedBatches[1]}`);
  }
  if (c.data.length !== 2) {
    throw new Error(`expected 2 rows got ${c.data.length}`);
  }

  __resetCacheForTests();
  state.calls = 0;
  const [p1, p2] = await Promise.all([
    getOrFetchPrices(["T5_BAG"], fetchMissing),
    getOrFetchPrices(["T5_BAG"], fetchMissing),
  ]);
  assertEq(state.calls, 1, "coalesce calls");
  const hits = [p1.cacheHit, p2.cacheHit];
  console.log("coalesce hits", hits);

  const after = await getOrFetchPrices(["T5_BAG"], fetchMissing, { fresh: true });
  if (after.cacheHit !== true) throw new Error(`fresh cooldown: hit=${after.cacheHit}`);
  assertEq(state.calls, 1, "fresh cooldown calls");

  // Simulate past cooldown + force fresh
  __resetCacheForTests();
  state.calls = 0;
  const t0 = Date.now();
  await getOrFetchPrices(["T5_BAG"], fetchMissing, { now: t0 });
  const forced = await getOrFetchPrices(["T5_BAG"], fetchMissing, {
    fresh: true,
    now: t0 + FRESH_COOLDOWN_MS + 1_000,
  });
  if (forced.cacheHit !== false) {
    throw new Error(`fresh after cooldown: hit=${forced.cacheHit}`);
  }
  assertEq(state.calls, 2, "fresh after cooldown calls");

  console.log("cache OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
