/**
 * Shared incremental price stores (city+BM and Brecilien).
 * Not wired to API routes until cache.ts adopts ensure* helpers.
 *
 * Semantics match lib/cache.ts:
 * - TTL: CACHE_TTL_MS
 * - fresh after FRESH_COOLDOWN_MS → full slice clear (no mixed ages)
 * - return rows only for neededIds
 * - one inflight per slice (coalesce parallel ensure)
 */
import {
  CACHE_SCHEMA_VERSION,
  CACHE_TTL_MS,
  FRESH_COOLDOWN_MS,
} from "./constants";
import type { AodpPriceRow } from "./types";

export type EnsureResult = {
  data: AodpPriceRow[];
  cacheHit: boolean;
  fetchedAt: number;
  expiresAt: number;
};

export type FetchMissing = (missingIds: string[]) => Promise<AodpPriceRow[]>;

type SliceState = {
  byItem: Map<string, AodpPriceRow[]>;
  fetchedAt: number;
  expiresAt: number;
  schemaVersion: string;
};

type SliceStore = {
  slice: SliceState | null;
  inflight: Promise<void> | null;
};

declare global {
  var __flipperCityBmPriceStore: SliceStore | undefined;
  var __flipperBrecilienPriceStore: SliceStore | undefined;
}

function cityBmStore(): SliceStore {
  if (!globalThis.__flipperCityBmPriceStore) {
    globalThis.__flipperCityBmPriceStore = { slice: null, inflight: null };
  }
  return globalThis.__flipperCityBmPriceStore;
}

function brecilienStore(): SliceStore {
  if (!globalThis.__flipperBrecilienPriceStore) {
    globalThis.__flipperBrecilienPriceStore = { slice: null, inflight: null };
  }
  return globalThis.__flipperBrecilienPriceStore;
}

function isFresh(slice: SliceState, now: number): boolean {
  return slice.schemaVersion === CACHE_SCHEMA_VERSION && now < slice.expiresAt;
}

function clearSlice(s: SliceStore): void {
  s.slice = null;
}

function collectRows(
  byItem: Map<string, AodpPriceRow[]>,
  neededIds: string[],
): AodpPriceRow[] {
  const out: AodpPriceRow[] = [];
  for (const id of neededIds) {
    const rows = byItem.get(id);
    if (rows) out.push(...rows);
  }
  return out;
}

function missingIds(byItem: Map<string, AodpPriceRow[]>, neededIds: string[]): string[] {
  const missing: string[] = [];
  for (const id of neededIds) {
    if (!byItem.has(id)) missing.push(id);
  }
  return missing;
}

/** Replace (not append) rows per item_id from a fetchMissing batch. */
function indexRows(byItem: Map<string, AodpPriceRow[]>, rows: AodpPriceRow[]): void {
  const grouped = new Map<string, AodpPriceRow[]>();
  for (const row of rows) {
    if (!row.item_id) continue;
    let list = grouped.get(row.item_id);
    if (!list) {
      list = [];
      grouped.set(row.item_id, list);
    }
    list.push(row);
  }
  for (const [id, list] of grouped) {
    byItem.set(id, list);
  }
}

async function ensureInStore(
  s: SliceStore,
  neededIds: string[],
  fetchMissing: FetchMissing,
  options: { fresh?: boolean; now?: number } = {},
): Promise<EnsureResult> {
  const now = options.now ?? Date.now();
  const wantFresh = options.fresh === true;
  const uniqueNeeded = [...new Set(neededIds)];

  if (uniqueNeeded.length === 0) {
    const fetchedAt = s.slice?.fetchedAt ?? now;
    const expiresAt = s.slice?.expiresAt ?? now + CACHE_TTL_MS;
    return { data: [], cacheHit: true, fetchedAt, expiresAt };
  }

  // Forced fresh after cooldown → wipe entire slice (no mixed ages).
  if (s.slice && isFresh(s.slice, now) && wantFresh) {
    const withinCooldown = now - s.slice.fetchedAt < FRESH_COOLDOWN_MS;
    if (!withinCooldown) {
      clearSlice(s);
    }
  }

  // Expired / wrong schema → clear
  if (s.slice && !isFresh(s.slice, now)) {
    clearSlice(s);
  }

  const tryHit = (): EnsureResult | null => {
    if (!s.slice || !isFresh(s.slice, now)) return null;
    if (missingIds(s.slice.byItem, uniqueNeeded).length > 0) return null;
    return {
      data: collectRows(s.slice.byItem, uniqueNeeded),
      cacheHit: true,
      fetchedAt: s.slice.fetchedAt,
      expiresAt: s.slice.expiresAt,
    };
  };

  for (;;) {
    const hit = tryHit();
    if (hit) return hit;

    if (s.inflight) {
      await s.inflight;
      continue;
    }

    // Claim inflight synchronously before any await.
    let release!: () => void;
    s.inflight = new Promise<void>((resolve) => {
      release = resolve;
    });

    const fetchStartedAt = now;
    let didNetwork = false;

    try {
      // Re-check after claiming (another peer may have filled while we waited
      // to enter this critical section — but we only get here if inflight was null).
      const racedHit = tryHit();
      if (racedHit) return racedHit;

      if (!s.slice || !isFresh(s.slice, now)) {
        s.slice = {
          byItem: new Map(),
          fetchedAt: fetchStartedAt,
          expiresAt: fetchStartedAt + CACHE_TTL_MS,
          schemaVersion: CACHE_SCHEMA_VERSION,
        };
      }

      const missing = missingIds(s.slice.byItem, uniqueNeeded);
      if (missing.length > 0) {
        didNetwork = true;
        const rows = await fetchMissing(missing);
        if (!s.slice) {
          s.slice = {
            byItem: new Map(),
            fetchedAt: fetchStartedAt,
            expiresAt: fetchStartedAt + CACHE_TTL_MS,
            schemaVersion: CACHE_SCHEMA_VERSION,
          };
        }
        indexRows(s.slice.byItem, rows);
      }

      if (!s.slice) {
        throw new Error("priceStore: slice missing after fetch");
      }

      const fetchedAt =
        options.now !== undefined ? fetchStartedAt : s.slice.fetchedAt;
      const expiresAt =
        options.now !== undefined
          ? fetchStartedAt + CACHE_TTL_MS
          : s.slice.expiresAt;

      return {
        data: collectRows(s.slice.byItem, uniqueNeeded),
        cacheHit: !didNetwork,
        fetchedAt,
        expiresAt,
      };
    } finally {
      s.inflight = null;
      release();
    }
  }
}

/** City markets + Black Market shared slice. */
export async function ensureCityBmPrices(
  neededIds: string[],
  fetchMissing: FetchMissing,
  options: { fresh?: boolean; now?: number } = {},
): Promise<EnsureResult> {
  return ensureInStore(cityBmStore(), neededIds, fetchMissing, options);
}

/** Brecilien-only slice (for upgrade location pack). */
export async function ensureBrecilienPrices(
  neededIds: string[],
  fetchMissing: FetchMissing,
  options: { fresh?: boolean; now?: number } = {},
): Promise<EnsureResult> {
  return ensureInStore(brecilienStore(), neededIds, fetchMissing, options);
}

export function clearCityBmPriceStore(): void {
  clearSlice(cityBmStore());
  cityBmStore().inflight = null;
}

export function clearBrecilienPriceStore(): void {
  clearSlice(brecilienStore());
  brecilienStore().inflight = null;
}

/** Test helper — reset both stores. */
export function __resetPriceStoresForTests(): void {
  clearCityBmPriceStore();
  clearBrecilienPriceStore();
}

export function getCityBmStoreMeta(now: number = Date.now()): {
  hasEntry: boolean;
  fetchedAt: number | null;
  expiresAt: number | null;
  ageMs: number | null;
  itemCount: number;
} {
  const slice = cityBmStore().slice;
  if (!slice) {
    return {
      hasEntry: false,
      fetchedAt: null,
      expiresAt: null,
      ageMs: null,
      itemCount: 0,
    };
  }
  return {
    hasEntry: true,
    fetchedAt: slice.fetchedAt,
    expiresAt: slice.expiresAt,
    ageMs: now - slice.fetchedAt,
    itemCount: slice.byItem.size,
  };
}
