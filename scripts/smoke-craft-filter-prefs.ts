/**
 * Craft filter prefs migration + roundtrip.
 * Usage: npx tsx scripts/smoke-craft-filter-prefs.ts
 */
import {
  CRAFT_FILTER_PREFS_VERSION,
  CRAFT_STORAGE_KEY,
  DEFAULT_CRAFT_FILTER_PREFS,
  readStoredCraftFilterPrefs,
  writeStoredCraftFilterPrefs,
} from "../lib/craftFilterPrefs";

function mockStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  // @ts-expect-error test shim
  globalThis.window = globalThis;
  // @ts-expect-error test shim
  globalThis.localStorage = ls;
  return store;
}

const store = mockStorage();

writeStoredCraftFilterPrefs({
  ...DEFAULT_CRAFT_FILTER_PREFS,
  buyMode: "Bridgewatch",
  familyFilter: "cape",
  threshold: 25_000,
});

const loaded = readStoredCraftFilterPrefs();
if (loaded.buyMode !== "Bridgewatch" || loaded.familyFilter !== "cape") {
  throw new Error(`roundtrip failed: ${JSON.stringify(loaded)}`);
}

// v1 caerleon → Caerleon
store.set(
  CRAFT_STORAGE_KEY,
  JSON.stringify({ v: 1, buyMode: "caerleon", threshold: 10_000 }),
);
const migrated = readStoredCraftFilterPrefs();
if (migrated.buyMode !== "Caerleon") {
  throw new Error(`v1 caerleon migrate failed: ${migrated.buyMode}`);
}

// v2 royal still works
store.set(
  CRAFT_STORAGE_KEY,
  JSON.stringify({ v: CRAFT_FILTER_PREFS_VERSION, buyMode: "royal" }),
);
if (readStoredCraftFilterPrefs().buyMode !== "royal") {
  throw new Error("royal preferred");
}

// bad version → defaults
store.set(CRAFT_STORAGE_KEY, JSON.stringify({ v: 999, buyMode: "Bridgewatch" }));
if (readStoredCraftFilterPrefs().buyMode !== DEFAULT_CRAFT_FILTER_PREFS.buyMode) {
  throw new Error("bad version should default");
}

console.log("craft filter prefs smoke ok");
