/**
 * Live smoke for craft flips pipeline (AODP + all buy modes).
 * Usage: npx tsx scripts/smoke-craft-api.ts
 */
import { fetchCraftPrices } from "../lib/aodp";
import {
  __resetCacheForTests,
  getOrFetchCraftPrices,
} from "../lib/cache";
import {
  CRAFT_BUY_MODES,
  buildCraftFlipsByMode,
  craftPriceItemIds,
  craftProfit,
  allowedCitiesFor,
} from "../lib/craftFlips";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main() {
  __resetCacheForTests();
  const ids = craftPriceItemIds();
  assert(ids.length > 100, `too few craft ids: ${ids.length}`);

  const first = await getOrFetchCraftPrices(ids, (missing) => fetchCraftPrices(missing));
  assert(!first.cacheHit, "first fetch should miss cache");
  assert(Array.isArray(first.data), "data array");

  const second = await getOrFetchCraftPrices(ids, (missing) => fetchCraftPrices(missing));
  assert(second.cacheHit, "second fetch should hit cache");

  const byMode = buildCraftFlipsByMode(first.data);
  const counts = CRAFT_BUY_MODES.map((m) => `${m}=${byMode[m].length}`).join(" ");
  console.log(`craft ${counts} priceRows=${first.data.length}`);

  for (const mode of CRAFT_BUY_MODES) {
    const allowed = allowedCitiesFor(mode);
    for (const f of byMode[mode].slice(0, 15)) {
      assert(f.buyMode === mode, `buyMode ${mode}`);
      assert(f.cost > 0 && f.bmBuy > 0, `prices ${mode} ${f.outputId}`);
      const sum = f.ingredients.reduce((s, i) => s + i.lineTotal, 0);
      assert(Math.abs(sum - f.cost) < 0.01, `breakdown ${f.outputId}`);
      assert(Number.isFinite(craftProfit(f.bmBuy, f.cost, 0.04)), `profit`);
      for (const ing of f.ingredients) {
        assert(allowed.has(ing.city), `${mode} ingredient city ${ing.city}`);
      }
    }
  }

  assert(
    byMode.Caerleon.length <= byMode.royal.length || byMode.Caerleon.length === 0,
    "caerleon usually fewer than royal pool",
  );

  console.log("smoke-craft-api ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
