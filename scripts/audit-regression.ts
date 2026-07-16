/**
 * Regression audit: BM flips + craft buy modes + prefs + profit math.
 * Usage: npx tsx scripts/audit-regression.ts
 */
import { fetchCraftPrices, fetchEuropePrices } from "../lib/aodp";
import { netAfterTax, profit as calcProfit } from "../lib/calc";
import {
  __resetCacheForTests,
  getOrFetchCraftPrices,
  getOrFetchPrices,
} from "../lib/cache";
import {
  CRAFT_BUY_MODES,
  CRAFT_RECIPES,
  allowedCitiesFor,
  buildCraftFlipsByMode,
  craftPriceItemIds,
  craftProfit,
  isCraftBuyMode,
} from "../lib/craftFlips";
import { buildFlips } from "../lib/flips";
import { ITEM_IDS } from "../lib/items";
import { CITY_LOCATIONS, ROYAL_CITIES, BLACK_MARKET } from "../lib/types";
import type { AodpPriceRow } from "../lib/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("429") || i === tries - 1) throw e;
      const wait = 5000 * (i + 1);
      console.log(`  … ${label} 429, wait ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function auditBmFlips() {
  console.log("\n[BM flips /]");
  __resetCacheForTests();
  const result = await withRetry("BM", () =>
    getOrFetchPrices(ITEM_IDS, (ids) => fetchEuropePrices(ids)),
  );
  assert(Array.isArray(result.data) && result.data.length > 0, "price rows");
  const flips = buildFlips(result.data);
  assert(flips.length > 0, `expected BM flips, got ${flips.length}`);

  for (const f of flips.slice(0, 50)) {
    assert(f.citySell > 0 && f.bmBuy > 0, `prices ${f.itemId}`);
    assert(CITY_LOCATIONS.includes(f.city as (typeof CITY_LOCATIONS)[number]), `city ${f.city}`);
    const p = calcProfit(f.bmBuy, f.citySell, 0.04);
    assert(Number.isFinite(p), `profit ${f.itemId}`);
    assert(
      Math.abs(p - (netAfterTax(f.bmBuy, 0.04) - f.citySell)) < 1e-6,
      `formula ${f.itemId}`,
    );
  }
  ok(`buildFlips=${flips.length} rows=${result.data.length}`);
}

async function auditCraftModes() {
  console.log("\n[Craft /craft buy modes]");
  __resetCacheForTests();
  const ids = craftPriceItemIds();
  assert(ids.length > 100, `ids ${ids.length}`);
  assert(CRAFT_RECIPES.length === 575, `recipes ${CRAFT_RECIPES.length}`);

  const { data } = await withRetry("craft", () =>
    getOrFetchCraftPrices(ids, (missing) => fetchCraftPrices(missing)),
  );
  const byMode = buildCraftFlipsByMode(data);

  for (const mode of CRAFT_BUY_MODES) {
    assert(Array.isArray(byMode[mode]), `missing mode ${mode}`);
  }
  assert(isCraftBuyMode("royal") && isCraftBuyMode("Bridgewatch"), "isCraftBuyMode");
  assert(!isCraftBuyMode("caerleon"), "lowercase caerleon invalid");
  assert(isCraftBuyMode("Caerleon"), "Caerleon valid");

  // City isolation + math only (royal vs single-city costs may diverge when
  // prefer-exact-quality finds a Q-match in another royal while a single city
  // falls back to Q1 — expected with current quality rules).
  for (const mode of CRAFT_BUY_MODES) {
    const allowed = allowedCitiesFor(mode);
    for (const f of byMode[mode]) {
      assert(f.buyMode === mode, `tag ${mode}`);
      const sum = f.ingredients.reduce((s, i) => s + i.lineTotal, 0);
      assert(Math.abs(sum - f.cost) < 1e-6, `sum ${mode} ${f.outputId}`);
      for (const ing of f.ingredients) {
        assert(allowed.has(ing.city), `${mode} got ${ing.city}`);
      }
      const p = craftProfit(f.bmBuy, f.cost, 0.04);
      assert(
        Math.abs(p - (f.bmBuy * 0.96 - f.cost)) < 1e-6,
        `profit ${mode} ${f.outputId}`,
      );
      // Best alternative: cost equals min of completable alts under this mode
      // (smoke covered; spot-check first 30 per mode)
    }
    const sample = byMode[mode].slice(0, 30);
    ok(`${mode}: ${byMode[mode].length} flips, checked ${sample.length}`);
  }

  ok(
    CRAFT_BUY_MODES.map((m) => `${m}=${byMode[m].length}`).join(" · "),
  );

  // Single royal-city counts ≤ royal pool (subset of purchasing power)
  for (const city of ROYAL_CITIES) {
    assert(
      byMode[city].length <= byMode.royal.length,
      `${city} count ${byMode[city].length} > royal ${byMode.royal.length}`,
    );
  }
  ok("each royal-city count ≤ royal pool");
}

function auditFixtureBridgewatch() {
  console.log("\n[Fixture city isolation]");
  const recipe = CRAFT_RECIPES.find((r) => r.outputId === "T4_CAPEITEM_DEMON");
  assert(!!recipe, "demon recipe in dump");

  const row = (
    item_id: string,
    city: string,
    sell: number,
    buy = 0,
  ): AodpPriceRow => ({
    item_id,
    city,
    quality: 1,
    sell_price_min: sell,
    sell_price_min_date: "2026-07-15T12:00:00",
    sell_price_max: 0,
    sell_price_max_date: "",
    buy_price_min: 0,
    buy_price_min_date: "",
    buy_price_max: buy,
    buy_price_max_date: buy ? "2026-07-15T12:00:00" : "",
  });

  const rows = [
    row("T4_CAPE", "Bridgewatch", 10_000),
    row("T4_CAPE", "Martlock", 8_000),
    row("T4_CAPEITEM_DEMON_BP", "Bridgewatch", 20_000),
    row("T1_FACTION_STEPPE_TOKEN_1", "Bridgewatch", 5_000),
    row("T1_FACTION_STEPPE_TOKEN_1", "Martlock", 4_000),
    row("T4_CAPEITEM_DEMON", BLACK_MARKET, 0, 50_000),
  ];

  const by = buildCraftFlipsByMode(rows, [recipe!], [1]);
  assert(by.Bridgewatch.length === 1, "BW flip");
  assert(by.Bridgewatch[0].cost === 35_000, `BW cost ${by.Bridgewatch[0].cost}`);
  assert(by.Martlock.length === 0, "Martlock incomplete (no BP)");
  assert(by.royal.length === 1, `royal cross-city got ${by.royal.length}`);
  assert(by.royal[0].cost === 32_000, `royal cost ${by.royal[0].cost}`);
  assert(by.Caerleon.length === 0, "Caerleon empty");

  ok("Bridgewatch isolation + royal cross-city cheapest");
}

function auditPrefsHelpers() {
  console.log("\n[Prefs / types]");
  for (const m of CRAFT_BUY_MODES) assert(isCraftBuyMode(m), m);
  assert(CRAFT_BUY_MODES.length === 1 + CITY_LOCATIONS.length, "mode count");
  ok(`CRAFT_BUY_MODES=${CRAFT_BUY_MODES.join(",")}`);
}

function auditCachesIsolated() {
  console.log("\n[Cache entrypoints]");
  // Shared city+BM store is reached via both entrypoints (missing-only fill).
  assert(typeof getOrFetchPrices === "function", "getOrFetchPrices");
  assert(typeof getOrFetchCraftPrices === "function", "getOrFetchCraftPrices");
  ok("getOrFetchPrices + getOrFetchCraftPrices (shared city+BM)");
}

async function main() {
  console.log("audit-regression start");
  auditPrefsHelpers();
  auditFixtureBridgewatch();
  auditCachesIsolated();
  await auditBmFlips();
  await auditCraftModes();
  console.log("\naudit-regression OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
