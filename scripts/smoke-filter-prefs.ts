import {
  DEFAULT_FILTER_PREFS,
  FILTER_PREFS_VERSION,
  readStoredFilterPrefs,
  writeStoredFilterPrefs,
} from "../lib/filterPrefs";

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

writeStoredFilterPrefs({
  threshold: 50_000,
  taxRate: 0.08,
  maxAge: 1440,
  cityFilter: "Martlock",
  qualityFilter: 4,
  sortTab: "fresh",
});

const loaded = readStoredFilterPrefs();
if (loaded.threshold !== 50_000 || loaded.sortTab !== "fresh") {
  throw new Error(`roundtrip failed: ${JSON.stringify(loaded)}`);
}

store.set("flipper-filters", "{bad");
if (readStoredFilterPrefs().threshold !== DEFAULT_FILTER_PREFS.threshold) {
  throw new Error("invalid JSON should return defaults");
}

store.set("flipper-filters", JSON.stringify({ v: 999, threshold: 50_000 }));
if (readStoredFilterPrefs().threshold !== DEFAULT_FILTER_PREFS.threshold) {
  throw new Error("wrong version should return defaults");
}

store.set(
  "flipper-filters",
  JSON.stringify({ v: FILTER_PREFS_VERSION, threshold: 999_999 }),
);
if (readStoredFilterPrefs().threshold !== DEFAULT_FILTER_PREFS.threshold) {
  throw new Error("bad threshold should fall back to default");
}

console.log("filter prefs smoke ok");
