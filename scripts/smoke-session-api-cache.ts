/**
 * Session API cache smoke (no network).
 * Usage: npx tsx scripts/smoke-session-api-cache.ts
 */
import {
  CITY_BM_SESSION_APIS,
  clearSessionApiCacheForTests,
  invalidateSiblingCityBmSessionCaches,
  readSessionApiCache,
  SESSION_API,
  writeSessionApiCache,
} from "../lib/sessionApiCache";
import { CACHE_TTL_MS } from "../lib/constants";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

clearSessionApiCacheForTests();

const now = 1_700_000_000_000;
const expiresAt = now + CACHE_TTL_MS;

writeSessionApiCache(SESSION_API.flips, {
  flips: [{ id: "a" }],
  fetchedAt: now,
  expiresAt,
  cacheHit: false,
});

const hit = readSessionApiCache<{ flips: unknown[]; cacheHit: boolean }>(
  SESSION_API.flips,
  now + 1000,
);
assert(!!hit, "read hit");
assert(Array.isArray(hit!.flips) && hit!.flips.length === 1, "payload");
assert(
  readSessionApiCache(SESSION_API.craft, now) === null,
  "other path empty",
);

assert(
  readSessionApiCache(SESSION_API.flips, expiresAt) === null,
  "expired at boundary",
);
assert(
  readSessionApiCache(SESSION_API.flips, now + 1000) === null,
  "expired entry removed",
);

writeSessionApiCache(SESSION_API.flips, {
  flips: [],
  fetchedAt: now,
  expiresAt,
  cacheHit: true,
});
writeSessionApiCache(SESSION_API.craft, {
  flipsByMode: {},
  fetchedAt: now,
  expiresAt,
  cacheHit: true,
});
writeSessionApiCache(SESSION_API.upgrade, {
  rows: [],
  fetchedAt: now,
  expiresAt,
  cacheHit: true,
});
writeSessionApiCache(SESSION_API.refine, {
  rows: [{ x: 1 }],
  fetchedAt: now,
  expiresAt,
  cacheHit: true,
});

invalidateSiblingCityBmSessionCaches(SESSION_API.craft);
assert(
  readSessionApiCache(SESSION_API.flips, now) === null,
  "sibling flips cleared",
);
assert(
  readSessionApiCache(SESSION_API.upgrade, now) === null,
  "sibling upgrade cleared",
);
assert(
  readSessionApiCache(SESSION_API.craft, now) !== null,
  "refreshed craft kept",
);
assert(
  readSessionApiCache(SESSION_API.refine, now) !== null,
  "refine untouched by city+BM invalidate",
);

assert(CITY_BM_SESSION_APIS.length === 3, "city+bm paths");
assert(CITY_BM_SESSION_APIS.includes(SESSION_API.flips), "includes flips");

clearSessionApiCacheForTests();
console.log("smoke-session-api-cache ok");
