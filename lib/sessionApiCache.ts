/**
 * In-memory session cache for dashboard API JSON.
 * Survives client-side navigations within the SPA; cleared on TTL (`expiresAt`)
 * or when a forced refresh actually hits the network for a shared city+BM endpoint.
 */

export const SESSION_API = {
  flips: "/api/flips",
  craft: "/api/craft-flips",
  upgrade: "/api/upgrade-flips",
  refine: "/api/refine-flips",
} as const;

export type SessionApiPath = (typeof SESSION_API)[keyof typeof SESSION_API];

/** Endpoints that share the server city+BM price store. */
export const CITY_BM_SESSION_APIS: readonly SessionApiPath[] = [
  SESSION_API.flips,
  SESSION_API.craft,
  SESSION_API.upgrade,
];

type CacheEntry = {
  payload: unknown;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();

export function readSessionApiCache<T>(
  path: SessionApiPath,
  now: number = Date.now(),
): T | null {
  const entry = store.get(path);
  if (!entry) return null;
  if (!(entry.expiresAt > now)) {
    store.delete(path);
    return null;
  }
  return entry.payload as T;
}

export function writeSessionApiCache<T extends { expiresAt: number }>(
  path: SessionApiPath,
  payload: T,
): void {
  store.set(path, { payload, expiresAt: payload.expiresAt });
}

export function invalidateSessionApiCache(path: SessionApiPath): void {
  store.delete(path);
}

export function invalidateSessionApiCaches(
  paths: readonly SessionApiPath[],
): void {
  for (const path of paths) store.delete(path);
}

/**
 * After a real network refresh (`fresh && !cacheHit`) on a city+BM page,
 * drop sibling session caches so they do not outlive a wiped server slice.
 */
export function invalidateSiblingCityBmSessionCaches(
  refreshedPath: SessionApiPath,
): void {
  invalidateSessionApiCaches(
    CITY_BM_SESSION_APIS.filter((p) => p !== refreshedPath),
  );
}

/** Test helper — empty the whole session map. */
export function clearSessionApiCacheForTests(): void {
  store.clear();
}
