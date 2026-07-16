/** Shared AODP price cache TTL for all users on this server process. */
export const CACHE_TTL_MS = 600_000;
/** Min gap between forced `?fresh=1` network refreshes (protects shared slice). */
export const FRESH_COOLDOWN_MS = 300_000;
export const PRICES_CACHE_KEY = "prices:europe";
/** Bump when price payload shape / qualities set changes. */
export const CACHE_SCHEMA_VERSION = "europe-q1-5-v4-shared-citybm";

/** HTTP Cache-Control for price API routes (CDN / reverse proxy). */
export function pricesCacheControlHeader(): string {
  const sMaxAge = Math.floor(CACHE_TTL_MS / 1000);
  return `public, s-maxage=${sMaxAge}, stale-while-revalidate=60`;
}
