import { CACHE_SCHEMA_VERSION, CACHE_TTL_MS, FRESH_COOLDOWN_MS } from "./constants";
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
  // eslint-disable-next-line no-var
  var __flipperPriceCache: MemoryStore | undefined;
}

function store(): MemoryStore {
  if (!globalThis.__flipperPriceCache) {
    globalThis.__flipperPriceCache = { entry: null, inflight: null };
  }
  return globalThis.__flipperPriceCache;
}

function isFresh(entry: CacheEntry, now: number): boolean {
  return entry.schemaVersion === CACHE_SCHEMA_VERSION && now < entry.expiresAt;
}

export function invalidate(): void {
  const s = store();
  s.entry = null;
}

export function getCacheMeta(now: number = Date.now()): {
  hasEntry: boolean;
  fetchedAt: number | null;
  expiresAt: number | null;
  ageMs: number | null;
} {
  const entry = store().entry;
  if (!entry) {
    return { hasEntry: false, fetchedAt: null, expiresAt: null, ageMs: null };
  }
  return {
    hasEntry: true,
    fetchedAt: entry.fetchedAt,
    expiresAt: entry.expiresAt,
    ageMs: now - entry.fetchedAt,
  };
}

/**
 * Get Europe prices from memory cache or fetcher.
 * `fresh=true` only forces a re-fetch after FRESH_COOLDOWN_MS since last successful fetch.
 */
export async function getOrFetchPrices(
  fetcher: () => Promise<AodpPriceRow[]>,
  options: { fresh?: boolean; now?: number } = {},
): Promise<CacheResult> {
  const now = options.now ?? Date.now();
  const s = store();
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
    // Prefer caller clock for tests; wall clock otherwise.
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

/** Test helper — reset store between unit checks. */
export function __resetCacheForTests(): void {
  globalThis.__flipperPriceCache = { entry: null, inflight: null };
}
