/**
 * Smoke: AODP enchanted-resource id mapping.
 * Usage: npx tsx scripts/smoke-aodp-item-ids.ts
 */
import { fromAodpMarketId, toAodpMarketId } from "../lib/aodpItemIds";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(toAodpMarketId("T8_PLANKS_LEVEL2") === "T8_PLANKS_LEVEL2@2", "to LEVEL2");
assert(toAodpMarketId("T4_WOOD_LEVEL1") === "T4_WOOD_LEVEL1@1", "to LEVEL1");
assert(toAodpMarketId("T8_PLANKS") === "T8_PLANKS", "base unchanged");
assert(toAodpMarketId("T4_BAG@1") === "T4_BAG@1", "equipment @ unchanged");

assert(fromAodpMarketId("T8_PLANKS_LEVEL2@2") === "T8_PLANKS_LEVEL2", "from @2");
assert(fromAodpMarketId("T4_WOOD_LEVEL1@1") === "T4_WOOD_LEVEL1", "from @1");
assert(fromAodpMarketId("T8_PLANKS") === "T8_PLANKS", "base from");
assert(fromAodpMarketId("T4_BAG@1") === "T4_BAG@1", "equipment from");

console.log("smoke-aodp-item-ids ok");
