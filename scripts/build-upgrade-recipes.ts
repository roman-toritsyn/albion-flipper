/**
 * Build data/upgrade-recipes.json — gear enchant paths (.0→.1/.2/.3 etc.)
 * with rune/soul/relic counts by slot (wiki Enchanting, post-Queen).
 *
 * Usage: npx tsx scripts/build-upgrade-recipes.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const XML_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.xml";

export type UpgradeSlot =
  | "oneHand"
  | "twoHand"
  | "armor"
  | "bag"
  | "small"; // head, shoes, cape, off-hand

export type UpgradeFamily =
  | "weapon"
  | "armor"
  | "head"
  | "shoes"
  | "offhand"
  | "cape"
  | "bag";

export type UpgradeMatKind = "RUNE" | "SOUL" | "RELIC";

export type UpgradeRecipe = {
  /** Base UniqueName without @enchant */
  baseId: string;
  tier: number;
  slot: UpgradeSlot;
  family: UpgradeFamily;
  matCount: number;
  fromEnchant: 0 | 1 | 2;
  toEnchant: 1 | 2 | 3;
  /** Mats to apply from→to (same N each step). */
  mats: Array<{ kind: UpgradeMatKind; itemId: string; count: number }>;
};

const MAT_COUNT: Record<UpgradeSlot, number> = {
  oneHand: 288,
  twoHand: 384,
  armor: 192,
  bag: 192,
  small: 96,
};

const PATHS: Array<{ from: 0 | 1 | 2; to: 1 | 2 | 3; kinds: UpgradeMatKind[] }> =
  [
    { from: 0, to: 1, kinds: ["RUNE"] },
    { from: 0, to: 2, kinds: ["RUNE", "SOUL"] },
    { from: 0, to: 3, kinds: ["RUNE", "SOUL", "RELIC"] },
    { from: 1, to: 2, kinds: ["SOUL"] },
    { from: 1, to: 3, kinds: ["SOUL", "RELIC"] },
    { from: 2, to: 3, kinds: ["RELIC"] },
  ];

function classify(uid: string): { slot: UpgradeSlot; family: UpgradeFamily } | null {
  const u = uid.toUpperCase();
  if (u.includes("_AVALON")) return null;
  if (u.includes("ARTEFACT") || u.includes("ARTIFACT")) return null;
  if (u.includes("MOUNT") || u.includes("_BABY") || u.includes("UNIQUE_")) return null;
  if (u.includes("POTION") || u.includes("MEAL") || u.includes("FOOD")) return null;
  if (u.includes("_BP") || u.includes("JOURNAL") || u.includes("TOKEN")) return null;
  if (u.includes("QUESTITEM") || u.includes("FARMABLE") || u.includes("FURNITURE"))
    return null;
  if (u.includes("SKILLBOOK") || u.includes("LOOTCHEST") || u.includes("RANDOM_"))
    return null;
  if (u.includes("_RUNE") || u.includes("_SOUL") || u.includes("_RELIC")) return null;
  if (u.includes("_LEVEL") || u.includes("ESSENCE") || u.includes("SHARD")) return null;

  // Gathering gear is not bought by Black Market — skip tools, gatherer sets, rods.
  if (
    u.includes("_TOOL_") ||
    u.includes("_GATHERER_") ||
    u.includes("_GATHER_") ||
    u.includes("FISHINGROD") ||
    u.includes("BACKPACK_GATHERER")
  ) {
    return null;
  }

  if (u.includes("_BAG") && !u.includes("BAGOF")) {
    return { slot: "bag", family: "bag" };
  }
  if (u.includes("CAPE")) return { slot: "small", family: "cape" };
  if (u.includes("_OFF_") || u.includes("_SHIELD") || u.includes("TORCH"))
    return { slot: "small", family: "offhand" };
  if (u.includes("_HEAD_")) return { slot: "small", family: "head" };
  if (u.includes("_SHOES_")) return { slot: "small", family: "shoes" };
  if (u.includes("_ARMOR_")) return { slot: "armor", family: "armor" };
  if (u.includes("_2H_") || /T\d_2H_/.test(u))
    return { slot: "twoHand", family: "weapon" };
  if (
    u.includes("_MAIN_") ||
    u.includes("_1H_") ||
    /T\d_(SWORD|AXE|MACE|HAMMER|SPEAR|DAGGER|NATURESTAFF|HOLYSTAFF|FIRESTAFF|FROSTSTAFF|CURSEDSTAFF|ARCANESTAFF|KNUCKLES|CROSSBOW|BOW)/.test(
      u,
    )
  ) {
    return { slot: "oneHand", family: "weapon" };
  }

  return null;
}

function parseTier(uid: string): number | null {
  const m = /^T([4-8])_/.exec(uid);
  return m ? Number(m[1]) : null;
}

function stripEnchant(uid: string): string {
  const i = uid.indexOf("@");
  return i >= 0 ? uid.slice(0, i) : uid;
}

function withEnchant(baseId: string, enchant: number): string {
  return enchant > 0 ? `${baseId}@${enchant}` : baseId;
}

function collectBaseIds(xml: string): Map<string, { slot: UpgradeSlot; family: UpgradeFamily; tier: number }> {
  const map = new Map<
    string,
    { slot: UpgradeSlot; family: UpgradeFamily; tier: number }
  >();
  // weapon / equipment / simpleitem — UniqueName on opening tag
  const re =
    /<(?:weapon|equipmentitem|simpleitem)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const uidRaw = /uniquename="([^"]+)"/i.exec(attrs)?.[1];
    if (!uidRaw) continue;
    const baseId = stripEnchant(uidRaw);
    if (map.has(baseId)) continue;
    const tier = parseTier(baseId);
    if (tier === null) continue;
    const cls = classify(baseId);
    if (!cls) continue;
    map.set(baseId, { ...cls, tier });
  }
  return map;
}

export function buildUpgradeRecipes(
  bases: Map<string, { slot: UpgradeSlot; family: UpgradeFamily; tier: number }>,
): UpgradeRecipe[] {
  const recipes: UpgradeRecipe[] = [];
  for (const [baseId, meta] of bases) {
    const matCount = MAT_COUNT[meta.slot];
    for (const path of PATHS) {
      const mats = path.kinds.map((kind) => ({
        kind,
        itemId: `T${meta.tier}_${kind}`,
        count: matCount,
      }));
      recipes.push({
        baseId,
        tier: meta.tier,
        slot: meta.slot,
        family: meta.family,
        matCount,
        fromEnchant: path.from,
        toEnchant: path.to,
        mats,
      });
    }
  }
  recipes.sort((a, b) => {
    if (a.baseId !== b.baseId) return a.baseId.localeCompare(b.baseId);
    if (a.fromEnchant !== b.fromEnchant) return a.fromEnchant - b.fromEnchant;
    return a.toEnchant - b.toEnchant;
  });
  return recipes;
}

export { withEnchant, MAT_COUNT, classify };

async function main() {
  const res = await fetch(XML_URL);
  if (!res.ok) throw new Error(`items.xml HTTP ${res.status}`);
  const xml = await res.text();
  const bases = collectBaseIds(xml);
  const recipes = buildUpgradeRecipes(bases);
  const path = join(process.cwd(), "data", "upgrade-recipes.json");
  writeFileSync(path, JSON.stringify(recipes), "utf8");

  const byFamily: Record<string, number> = {};
  const uniqueBases = new Set(recipes.map((r) => r.baseId));
  for (const r of recipes) {
    byFamily[r.family] = (byFamily[r.family] || 0) + 1;
  }
  console.log(`wrote ${path}`);
  console.log(`bases=${uniqueBases.size} recipes=${recipes.length}`, byFamily);

  const jacket = [...bases.entries()].find(
    ([id, m]) =>
      m.family === "armor" &&
      id.startsWith("T6_") &&
      id.includes("ARMOR_CLOTH") &&
      !id.includes("ARTEFACT"),
  );
  if (!jacket) throw new Error("missing T6 cloth armor sample");
  const [jid, jmeta] = jacket;
  if (MAT_COUNT[jmeta.slot] !== 192) {
    throw new Error(`${jid} expected matCount 192 got ${MAT_COUNT[jmeta.slot]}`);
  }
  const twoHand = [...bases.entries()].find(
    ([id, m]) => m.slot === "twoHand" && id.startsWith("T6_"),
  );
  if (!twoHand || MAT_COUNT[twoHand[1].slot] !== 384) {
    throw new Error("T6 2H matCount smoke failed");
  }
  console.log("smoke slot counts ok", jid, twoHand[0]);

  const dual = bases.get("T6_2H_DUALSICKLE_UNDEAD");
  if (!dual || dual.family !== "weapon" || dual.slot !== "twoHand") {
    throw new Error(`Dual Sickle classify failed: ${JSON.stringify(dual)}`);
  }
  if (bases.has("T6_ARMOR_GATHERER_ORE") || bases.has("T6_2H_TOOL_SICKLE")) {
    throw new Error("gather gear must be excluded from upgrade recipes");
  }
  console.log("smoke classify weapon ok; gather excluded");
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /build-upgrade-recipes\.(ts|js)$/.test(process.argv[1].replace(/\\/g, "/"));

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}