import type { AodpPriceRow } from "./types";
import { BLACK_MARKET, CITY_LOCATIONS, REFINE_CITIES } from "./types";
import { fromAodpMarketId, toAodpMarketId } from "./aodpItemIds";

const AODP_HOST = "https://europe.albion-online-data.com";
/** Royal cities + Caerleon + Black Market — shared by flips / craft / upgrade city pack. */
const FLIP_LOCATIONS = [...CITY_LOCATIONS, BLACK_MARKET].join(",");
/** All Albion qualities: Normal → Masterpiece */
const QUALITIES = "1,2,3,4,5";
const BATCH_SIZE = 60;

const MAX_CONCURRENCY = 3;
const MAX_URL_LENGTH = 4000;

export function chunkItemIds(
  itemIds: string[],
  batchSize = BATCH_SIZE,
  locations: string = FLIP_LOCATIONS,
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];

  for (const id of itemIds) {
    const trial = current.length === 0 ? [id] : [...current, id];
    const url = buildPricesUrl(trial, locations);
    if (url.length > MAX_URL_LENGTH && current.length > 0) {
      chunks.push(current);
      current = [id];
    } else if (trial.length > batchSize && current.length > 0) {
      chunks.push(current);
      current = [id];
    } else {
      current = trial;
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function buildPricesUrl(
  itemIds: string[],
  locations: string = FLIP_LOCATIONS,
): string {
  const ids = itemIds.join(",");
  return `${AODP_HOST}/api/v2/stats/prices/${ids}.json?locations=${encodeURIComponent(locations)}&qualities=${QUALITIES}`;
}

async function fetchBatch(
  itemIds: string[],
  locations: string,
): Promise<AodpPriceRow[]> {
  const url = buildPricesUrl(itemIds, locations);
  if (url.length > 4096) {
    throw new Error(`AODP URL too long (${url.length}): reduce batch size`);
  }

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`AODP HTTP ${res.status} for ${itemIds.length} items`);
  }

  const data = (await res.json()) as AodpPriceRow[];
  if (!Array.isArray(data)) {
    throw new Error("AODP returned non-array payload");
  }
  return data;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

async function fetchPrices(
  itemIds: string[],
  locations: string,
  label: string,
): Promise<AodpPriceRow[]> {
  if (itemIds.length === 0) return [];

  const batches = chunkItemIds(itemIds, BATCH_SIZE, locations);
  const started = Date.now();

  const batchResults = await mapPool(batches, MAX_CONCURRENCY, async (batch) => {
    return fetchBatch(batch, locations);
  });

  const rows = batchResults.flat();
  console.info(
    `[aodp:${label}] batches=${batches.length} items=${itemIds.length} rows=${rows.length} ms=${Date.now() - started}`,
  );
  return rows;
}

/** Fetch Europe market prices for BM flips (all cities + Black Market). */
export async function fetchEuropePrices(itemIds: string[]): Promise<AodpPriceRow[]> {
  return fetchCityBmPrices(itemIds);
}

/** Fetch city + BM prices for craft flips. */
export async function fetchCraftPrices(itemIds: string[]): Promise<AodpPriceRow[]> {
  return fetchCityBmPrices(itemIds);
}

/** City markets + Black Market (shared location pack for flips/craft/upgrade). */
export async function fetchCityBmPrices(itemIds: string[]): Promise<AodpPriceRow[]> {
  return fetchPrices(itemIds, FLIP_LOCATIONS, "city+bm");
}

/** Brecilien-only prices (upgrade location pack). */
export async function fetchBrecilienPrices(itemIds: string[]): Promise<AodpPriceRow[]> {
  return fetchPrices(itemIds, "Brecilien", "brecilien");
}

/** Fetch city market prices for refine (no BM needed). */
export async function fetchRefinePrices(itemIds: string[]): Promise<AodpPriceRow[]> {
  const aodpIds = [...new Set(itemIds.map(toAodpMarketId))];
  const rows = await fetchPrices(aodpIds, REFINE_CITIES.join(","), "refine");
  // Normalize enchanted-resource ids back to dump UniqueNames (…_LEVELn).
  return rows.map((row) => ({
    ...row,
    item_id: fromAodpMarketId(row.item_id),
  }));
}

/**
 * Fetch buy cities + BM + Brecilien for upgrade (single-shot facade).
 * Prefer getOrFetchUpgradePrices + split cityBm/brecilien packs in API routes.
 */
export async function fetchUpgradePrices(itemIds: string[]): Promise<AodpPriceRow[]> {
  const [cityBm, brec] = await Promise.all([
    fetchCityBmPrices(itemIds),
    fetchBrecilienPrices(itemIds),
  ]);
  return [...cityBm, ...brec];
}
