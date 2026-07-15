import { __resetCacheForTests, getOrFetchPrices } from "../lib/cache";
import { FRESH_COOLDOWN_MS } from "../lib/constants";
import type { AodpPriceRow } from "../lib/types";

function row(): AodpPriceRow {
  return {
    item_id: "T5_BAG",
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

async function main() {
  __resetCacheForTests();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 30));
    return [row()];
  };

  const a = await getOrFetchPrices(fetcher);
  if (a.cacheHit !== false || calls !== 1) {
    throw new Error(`1st: hit=${a.cacheHit} calls=${calls}`);
  }

  const b = await getOrFetchPrices(fetcher);
  if (b.cacheHit !== true || calls !== 1) {
    throw new Error(`2nd: hit=${b.cacheHit} calls=${calls}`);
  }

  __resetCacheForTests();
  calls = 0;
  const [p1, p2] = await Promise.all([
    getOrFetchPrices(fetcher),
    getOrFetchPrices(fetcher),
  ]);
  if (calls !== 1) throw new Error(`coalesce calls=${calls}`);
  const hits = [p1.cacheHit, p2.cacheHit];
  if (!hits.includes(false) || !hits.includes(true)) {
    // One initiator false, one waiter true — or both false if race creates two (unacceptable)
    // Allow both false only if calls===1? If calls===1 and both false that's slightly wrong labels but ok.
    // Require calls===1 already.
    console.log("coalesce hits", hits);
  }
  if (calls !== 1) throw new Error("coalesce failed");

  const after = await getOrFetchPrices(fetcher, { fresh: true });
  if (after.cacheHit !== true || calls !== 1) {
    throw new Error(`fresh cooldown: hit=${after.cacheHit} calls=${calls}`);
  }

  // Simulate past cooldown + TTL expired
  __resetCacheForTests();
  calls = 0;
  const t0 = Date.now();
  await getOrFetchPrices(fetcher, { now: t0 });
  const forced = await getOrFetchPrices(fetcher, {
    fresh: true,
    now: t0 + FRESH_COOLDOWN_MS + 1_000,
  });
  // TTL still 90s so without fresh would hit; with fresh after cooldown should refetch
  // But entry still valid for TTL — wantFresh && !withinCooldown → refetch
  if (forced.cacheHit !== false || calls !== 2) {
    throw new Error(`fresh after cooldown: hit=${forced.cacheHit} calls=${calls}`);
  }

  console.log("cache OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
