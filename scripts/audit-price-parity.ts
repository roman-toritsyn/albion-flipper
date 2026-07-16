/**
 * Canonical parity: AodpPriceRow fixtures → build* snapshots (order-independent).
 * Used as baseline (step 0) and later vs shared price store.
 *
 * Cache invariants (runtime, lib/cache.ts):
 * - TTL: CACHE_TTL_MS = 600_000 (10 min)
 * - fresh cooldown: FRESH_COOLDOWN_MS = 300_000
 * - refine stays on its own cache slice (not shared city+BM)
 *
 * Usage: npx tsx scripts/audit-price-parity.ts
 */
import { createHash } from "node:crypto";
import {
  buildCraftFlipsByMode,
  type CraftRecipe,
} from "../lib/craftFlips";
import { CACHE_TTL_MS, FRESH_COOLDOWN_MS } from "../lib/constants";
import { buildFlips } from "../lib/flips";
import {
  buildUpgradeFlips,
  type UpgradeRecipe,
} from "../lib/upgradeFlips";
import type { AodpPriceRow } from "../lib/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function row(
  item_id: string,
  city: string,
  quality: number,
  sell_price_min: number,
  buy_price_max: number,
): AodpPriceRow {
  return {
    item_id,
    city,
    quality,
    sell_price_min,
    sell_price_min_date: "2026-07-15T10:00:00",
    sell_price_max: 0,
    sell_price_max_date: "",
    buy_price_min: 0,
    buy_price_min_date: "",
    buy_price_max,
    buy_price_max_date: "2026-07-15T10:00:00",
  };
}

/** Canonical key for a market row (order-independent map). */
export function rowKey(r: AodpPriceRow): string {
  return `${r.item_id}|${r.city}|${r.quality || 1}`;
}

export function canonicalizeRows(rows: AodpPriceRow[]): string {
  const sorted = [...rows].sort((a, b) => rowKey(a).localeCompare(rowKey(b)));
  return JSON.stringify(sorted);
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    const mapped = value.map(sortDeep);
    // Sort arrays of plain objects by JSON string for stability
    if (
      mapped.every(
        (x) => x !== null && typeof x === "object" && !Array.isArray(x),
      )
    ) {
      return [...mapped].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
      );
    }
    return mapped;
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = sortDeep(obj[k]);
    }
    return out;
  }
  return value;
}

export function canonicalHash(value: unknown): string {
  return hashJson(sortDeep(value));
}

export function assertSameCanonical(a: unknown, b: unknown, label: string): void {
  const ha = canonicalHash(a);
  const hb = canonicalHash(b);
  assert(ha === hb, `${label}: hash mismatch\n  a=${ha}\n  b=${hb}`);
}

/** Filter rows to a set of item ids (store ensure* contract). */
export function rowsForIds(rows: AodpPriceRow[], ids: string[]): AodpPriceRow[] {
  const set = new Set(ids);
  return rows.filter((r) => set.has(r.item_id));
}

const demonRecipe: CraftRecipe = {
  outputId: "T4_CAPEITEM_DEMON",
  enchant: 0,
  family: "cape",
  alternatives: [
    {
      ingredients: [
        { itemId: "T4_CAPE", count: 1 },
        { itemId: "T4_CAPEITEM_DEMON_BP", count: 1 },
        { itemId: "T1_FACTION_STEPPE_TOKEN_1", count: 1 },
      ],
    },
  ],
};

const capeUpgradeRecipe: UpgradeRecipe = {
  baseId: "T4_CAPE",
  tier: 4,
  slot: "small",
  family: "cape",
  matCount: 96,
  fromEnchant: 0,
  toEnchant: 1,
  mats: [{ kind: "RUNE", itemId: "T4_RUNE", count: 96 }],
};

/** Shared fixture covering flips + craft + upgrade city/BM (+ Brecilien rune). */
export const PARITY_ROWS: AodpPriceRow[] = [
  // Flip: bag city → BM
  row("T6_BAG@3", "Black Market", 1, 0, 100_000),
  row("T6_BAG@3", "Caerleon", 1, 80_000, 0),
  row("T6_BAG@3", "Lymhurst", 1, 90_000, 0),
  // Craft cape ingredients + BM output
  row("T4_CAPE", "Martlock", 1, 10_000, 0),
  row("T4_CAPE", "Bridgewatch", 1, 12_000, 0),
  row("T4_CAPEITEM_DEMON_BP", "Thetford", 1, 20_000, 0),
  row("T1_FACTION_STEPPE_TOKEN_1", "Lymhurst", 1, 5_000, 0),
  row("T4_CAPEITEM_DEMON", "Black Market", 1, 0, 50_000),
  // Upgrade mats + output BM + Brecilien mat
  row("T4_RUNE", "Thetford", 1, 100, 0),
  row("T4_RUNE", "Martlock", 1, 200, 0),
  row("T4_RUNE", "Brecilien", 1, 90, 0),
  row("T4_CAPE@1", "Black Market", 1, 0, 30_000),
];

async function main() {
  console.log("[audit-price-parity] fixtures + shared city+BM (+ Brecilien upgrade)");
  console.log(
    `  cache invariants: TTL=${CACHE_TTL_MS}ms freshCooldown=${FRESH_COOLDOWN_MS}ms refine=separate`,
  );

  // Stable row map
  const rowMapHash = hashJson(
    Object.fromEntries(
      [...PARITY_ROWS]
        .sort((a, b) => rowKey(a).localeCompare(rowKey(b)))
        .map((r) => [rowKey(r), r]),
    ),
  );
  ok(`row map hash=${rowMapHash.slice(0, 16)}…`);

  // Flips
  const flips = buildFlips(PARITY_ROWS);
  const flipsHash = canonicalHash(flips);
  assert(flips.length >= 2, `flips count ${flips.length}`);
  ok(`buildFlips n=${flips.length} hash=${flipsHash.slice(0, 16)}…`);

  // Subset filter must not change flips for bag ids only + same BM/city
  const flipIds = ["T6_BAG@3"];
  const flipsSubset = buildFlips(rowsForIds(PARITY_ROWS, flipIds));
  assertSameCanonical(flips, flipsSubset, "flips full vs id-filter");
  ok("flips id-filter equivalent");

  // Craft
  const craftByMode = buildCraftFlipsByMode(PARITY_ROWS, [demonRecipe], [1]);
  const craftHash = canonicalHash(craftByMode);
  assert(craftByMode.royal.length === 1, "craft royal");
  assert(craftByMode.royal[0].cost === 35_000, "craft cost");
  ok(`buildCraftFlipsByMode hash=${craftHash.slice(0, 16)}…`);

  const craftIds = [
    "T4_CAPE",
    "T4_CAPEITEM_DEMON_BP",
    "T1_FACTION_STEPPE_TOKEN_1",
    "T4_CAPEITEM_DEMON",
  ];
  const craftSubset = buildCraftFlipsByMode(
    rowsForIds(PARITY_ROWS, craftIds),
    [demonRecipe],
    [1],
  );
  assertSameCanonical(craftByMode, craftSubset, "craft full vs id-filter");
  ok("craft id-filter equivalent");

  // Upgrade
  const upgrades = buildUpgradeFlips(PARITY_ROWS, {
    buyCity: "auto",
    qualities: [1],
    recipes: [capeUpgradeRecipe],
  });
  const upgradeHash = canonicalHash(upgrades);
  assert(upgrades.length === 1, `upgrade n=${upgrades.length}`);
  // auto picks cheapest rune — Brecilien 90 beats Thetford 100
  assert(upgrades[0].cost === 10_000 + 96 * 90, `upgrade cost ${upgrades[0].cost}`);
  ok(`buildUpgradeFlips hash=${upgradeHash.slice(0, 16)}…`);

  const upgradeIds = ["T4_CAPE", "T4_RUNE", "T4_CAPE@1"];
  const upgradeSubset = buildUpgradeFlips(rowsForIds(PARITY_ROWS, upgradeIds), {
    buyCity: "auto",
    qualities: [1],
    recipes: [capeUpgradeRecipe],
  });
  assertSameCanonical(upgrades, upgradeSubset, "upgrade full vs id-filter");
  ok("upgrade id-filter equivalent");

  // Re-run → same hashes (reproducible)
  assert(
    canonicalHash(buildFlips(PARITY_ROWS)) === flipsHash,
    "flips reproducible",
  );
  assert(
    canonicalHash(buildCraftFlipsByMode(PARITY_ROWS, [demonRecipe], [1])) ===
      craftHash,
    "craft reproducible",
  );
  assert(
    canonicalHash(
      buildUpgradeFlips(PARITY_ROWS, {
        buyCity: "auto",
        qualities: [1],
        recipes: [capeUpgradeRecipe],
      }),
    ) === upgradeHash,
    "upgrade reproducible",
  );
  ok("snapshots reproducible");

  // Shared-store path: ensure flip ids then craft ids → same build* as direct subsets
  {
    const {
      __resetPriceStoresForTests,
      ensureBrecilienPrices,
      ensureCityBmPrices,
    } = await import("../lib/priceStore");
    __resetPriceStoresForTests();

    const cityBmByItem = new Map<string, AodpPriceRow[]>();
    const brecByItem = new Map<string, AodpPriceRow[]>();
    for (const r of PARITY_ROWS) {
      const map = r.city === "Brecilien" ? brecByItem : cityBmByItem;
      let list = map.get(r.item_id);
      if (!list) {
        list = [];
        map.set(r.item_id, list);
      }
      list.push(r);
    }

    let cityCalls = 0;
    let brecCalls = 0;
    const fetchCity = async (missing: string[]) => {
      cityCalls += 1;
      return missing.flatMap((id) => cityBmByItem.get(id) ?? []);
    };
    const fetchBrec = async (missing: string[]) => {
      brecCalls += 1;
      return missing.flatMap((id) => brecByItem.get(id) ?? []);
    };

    const flipIds = ["T6_BAG@3"];
    const craftIds = [
      "T4_CAPE",
      "T4_CAPEITEM_DEMON_BP",
      "T1_FACTION_STEPPE_TOKEN_1",
      "T4_CAPEITEM_DEMON",
    ];

    const flipEnsure = await ensureCityBmPrices(flipIds, fetchCity);
    assert(cityCalls === 1, `flip ensure calls ${cityCalls}`);
    assertSameCanonical(
      buildFlips(flipEnsure.data),
      buildFlips(rowsForIds(PARITY_ROWS, flipIds)),
      "store flips vs direct",
    );

    const craftEnsure = await ensureCityBmPrices(craftIds, fetchCity);
    assert(cityCalls === 2, `craft missing-only calls ${cityCalls}`);
    assertSameCanonical(
      buildCraftFlipsByMode(craftEnsure.data, [demonRecipe], [1]),
      craftByMode,
      "store craft vs direct",
    );
    ok("shared store ensure → build* parity (flips then craft)");

    // Upgrade: city+BM + Brecilien merge
    const upgradeIds = ["T4_CAPE", "T4_RUNE", "T4_CAPE@1"];
    const [cityPart, brecPart] = await Promise.all([
      ensureCityBmPrices(upgradeIds, fetchCity),
      ensureBrecilienPrices(upgradeIds, fetchBrec),
    ]);
    // T4_CAPE / T4_CAPE@1 already warm; T4_RUNE city may be new → ≤1 more city call
    assert(cityCalls <= 3, `upgrade city calls ${cityCalls}`);
    assert(brecCalls === 1, `brec calls ${brecCalls}`);
    const merged = [...cityPart.data, ...brecPart.data];
    const storeUpgrades = buildUpgradeFlips(merged, {
      buyCity: "auto",
      qualities: [1],
      recipes: [capeUpgradeRecipe],
    });
    assertSameCanonical(storeUpgrades, upgrades, "store upgrade vs direct");
    ok("shared store + brecilien → buildUpgradeFlips parity");
  }

  console.log("audit-price-parity OK (flips/craft/upgrade shared store)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
