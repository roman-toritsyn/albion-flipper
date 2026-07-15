import type { AodpPriceRow } from "./types";
import { BLACK_MARKET, CITY_LOCATIONS } from "./types";

const AODP_HOST = "https://europe.albion-online-data.com";
const LOCATIONS = [...CITY_LOCATIONS, BLACK_MARKET].join(",");
/** All Albion qualities: Normal → Masterpiece */
const QUALITIES = "1,2,3,4,5";
const BATCH_SIZE = 60;

const MAX_CONCURRENCY = 3;
const MAX_URL_LENGTH = 4000;

export function chunkItemIds(itemIds: string[], batchSize = BATCH_SIZE): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];

  for (const id of itemIds) {
    const trial = current.length === 0 ? [id] : [...current, id];
    const url = buildPricesUrl(trial);
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

export function buildPricesUrl(itemIds: string[]): string {
  const ids = itemIds.join(",");
  return `${AODP_HOST}/api/v2/stats/prices/${ids}.json?locations=${encodeURIComponent(LOCATIONS)}&qualities=${QUALITIES}`;
}

async function fetchBatch(itemIds: string[]): Promise<AodpPriceRow[]> {
  const url = buildPricesUrl(itemIds);
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

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

/** Fetch Europe market prices for the given item IDs (batched). */
export async function fetchEuropePrices(itemIds: string[]): Promise<AodpPriceRow[]> {
  if (itemIds.length === 0) return [];

  const batches = chunkItemIds(itemIds);
  const started = Date.now();

  const batchResults = await mapPool(batches, MAX_CONCURRENCY, async (batch) => {
    return fetchBatch(batch);
  });

  const rows = batchResults.flat();
  console.info(
    `[aodp] batches=${batches.length} items=${itemIds.length} rows=${rows.length} ms=${Date.now() - started}`,
  );
  return rows;
}
