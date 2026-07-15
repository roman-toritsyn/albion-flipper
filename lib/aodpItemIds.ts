/**
 * AODP market item ids vs ao-bin-dumps UniqueNames.
 *
 * Enchanted resources (wood/ore/hide/fiber/rock and refined forms) are UniqueName
 * `T4_WOOD_LEVEL1` in the dump, but market uploads/API use `T4_WOOD_LEVEL1@1`.
 * Equipment uses only `@n` (e.g. T4_BAG@1) — unchanged by these helpers.
 */

const LEVEL_ONLY = /^(.*_LEVEL([1-4]))$/;
const LEVEL_AT = /^(.*_LEVEL([1-4]))@([1-4])$/;

/** Dump UniqueName → AODP market id for price requests. */
export function toAodpMarketId(itemId: string): string {
  const m = LEVEL_ONLY.exec(itemId);
  if (!m) return itemId;
  return `${m[1]}@${m[2]}`;
}

/** AODP response item_id → dump UniqueName used in recipes. */
export function fromAodpMarketId(itemId: string): string {
  const m = LEVEL_AT.exec(itemId);
  if (!m) return itemId;
  // Prefer stripping only when @ matches LEVEL (AODP convention).
  if (m[2] === m[3]) return m[1];
  return m[1];
}
