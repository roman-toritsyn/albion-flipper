import { CACHE_SCHEMA_VERSION, CACHE_TTL_MS, FRESH_COOLDOWN_MS } from "./constants";
import {
  __resetPriceStoresForTests,
  clearBrecilienPriceStore,
  clearCityBmPriceStore,
  ensureBrecilienPrices,
  ensureCityBmPrices,
  getCityBmStoreMeta,
  type FetchMissing,
} from "./priceStore";
import type { AodpPriceRow } from "./types";

export { CACHE_TTL_MS, FRESH_COOLDOWN_MS };

type CacheEntry = {
  data: AodpPriceRow[];
  fetchedAt: number;
  expiresAt: number;
  schemaVersion: string;
};

export type CacheResult = {
  data: AodpPriceRow[];
  cacheHit: boolean;
  fetchedAt: number;
  expiresAt: number;
};

type MemoryStore = {
  entry: CacheEntry | null;
  inflight: Promise<CacheEntry> | null;
};

declare global {
  // Persist across hot reloads in Next.js dev
  var __flipperRefinePriceCache: MemoryStore | undefined;
}

function refineStore(): MemoryStore {
  if (!globalThis.__flipperRefinePriceCache) {
    globalThis.__flipperRefinePriceCache = { entry: null, inflight: null };
  }
  return globalThis.__flipperRefinePriceCache;
}

function isFresh(entry: CacheEntry, now: number): boolean {
  return entry.schemaVersion === CACHE_SCHEMA_VERSION && now < entry.expiresAt;
}

/** Clears shared city+BM store (flips + craft + upgrade city pack). */
export function invalidate(): void {
  clearCityBmPriceStore();
}

/** Alias of invalidate — craft uses the same city+BM slice. */
export function invalidateCraft(): void {
  clearCityBmPriceStore();
}

export function invalidateRefine(): void {
  refineStore().entry = null;
}

/** Clears Brecilien upgrade slice (city+BM remains shared). */
export function invalidateUpgrade(): void {
  clearBrecilienPriceStore();
}

export function getCacheMeta(now: number = Date.now()): {
  hasEntry: boolean;
  fetchedAt: number | null;
  expiresAt: number | null;
  ageMs: number | null;
} {
  const meta = getCityBmStoreMeta(now);
  return {
    hasEntry: meta.hasEntry,
    fetchedAt: meta.fetchedAt,
    expiresAt: meta.expiresAt,
    ageMs: meta.ageMs,
  };
}

async function getOrFetchRefine(
  fetcher: () => Promise<AodpPriceRow[]>,
  options: { fresh?: boolean; now?: number } = {},
): Promise<CacheResult> {
  const now = options.now ?? Date.now();
  const s = refineStore();
  const wantFresh = options.fresh === true;

  if (s.entry && isFresh(s.entry, now)) {
    const withinCooldown = now - s.entry.fetchedAt < FRESH_COOLDOWN_MS;
    if (!wantFresh || withinCooldown) {
      return {
        data: s.entry.data,
        cacheHit: true,
        fetchedAt: s.entry.fetchedAt,
        expiresAt: s.entry.expiresAt,
      };
    }
  }

  if (s.inflight) {
    const entry = await s.inflight;
    return {
      data: entry.data,
      cacheHit: true,
      fetchedAt: entry.fetchedAt,
      expiresAt: entry.expiresAt,
    };
  }

  const fetchStartedAt = now;
  s.inflight = (async () => {
    const data = await fetcher();
    const fetchedAt = options.now !== undefined ? fetchStartedAt : Date.now();
    const entry: CacheEntry = {
      data,
      fetchedAt,
      expiresAt: fetchedAt + CACHE_TTL_MS,
      schemaVersion: CACHE_SCHEMA_VERSION,
    };
    s.entry = entry;
    return entry;
  })();

  try {
    const entry = await s.inflight;
    return {
      data: entry.data,
      cacheHit: false,
      fetchedAt: entry.fetchedAt,
      expiresAt: entry.expiresAt,
    };
  } finally {
    s.inflight = null;
  }
}

/**
 * Shared city+BM prices for BM flips.
 * Fetches only missing item ids; `fresh=true` clears the slice after cooldown.
 */
export async function getOrFetchPrices(
  itemIds: string[],
  fetchMissing: FetchMissing,
  options: { fresh?: boolean; now?: number } = {},
): Promise<CacheResult> {
  return ensureCityBmPrices(itemIds, fetchMissing, options);
}

/**
 * Shared city+BM prices for craft (same slice as flips).
 * Fetches only missing item ids.
 */
export async function getOrFetchCraftPrices(
  itemIds: string[],
  fetchMissing: FetchMissing,
  options: { fresh?: boolean; now?: number } = {},
): Promise<CacheResult> {
  return ensureCityBmPrices(itemIds, fetchMissing, options);
}

/** Separate cache for refine (raw + refined) city market prices. */
export async function getOrFetchRefinePrices(
  fetcher: () => Promise<AodpPriceRow[]>,
  options: { fresh?: boolean; now?: number } = {},
): Promise<CacheResult> {
  return getOrFetchRefine(fetcher, options);
}

export type UpgradeFetchers = {
  fetchCityBm: FetchMissing;
  fetchBrecilien: FetchMissing;
};

/**
 * Upgrade prices: shared city+BM slice + dedicated Brecilien slice.
 * Merged rows are equivalent to a single UPGRADE_LOCATIONS fetch.
 */
export async function getOrFetchUpgradePrices(
  itemIds: string[],
  fetchers: UpgradeFetchers,
  options: { fresh?: boolean; now?: number } = {},
): Promise<CacheResult> {
  const [cityBm, brec] = await Promise.all([
    ensureCityBmPrices(itemIds, fetchers.fetchCityBm, options),
    ensureBrecilienPrices(itemIds, fetchers.fetchBrecilien, options),
  ]);

  return {
    data: [...cityBm.data, ...brec.data],
    cacheHit: cityBm.cacheHit && brec.cacheHit,
    fetchedAt: Math.min(cityBm.fetchedAt, brec.fetchedAt),
    expiresAt: Math.min(cityBm.expiresAt, brec.expiresAt),
  };
}

/** Test helper — reset store between unit checks. */
export function __resetCacheForTests(): void {
  __resetPriceStoresForTests();
  globalThis.__flipperRefinePriceCache = { entry: null, inflight: null };
}
