import recipesJson from "../data/upgrade-recipes.json";
import { isFresh, netAfterTax, profit as calcProfit, roi as calcRoi } from "./calc";
import { qualityKey } from "./quality";
import type { AodpPriceRow, CityLocation } from "./types";
import { BLACK_MARKET, CITY_LOCATIONS } from "./types";

export type UpgradeSlot = "oneHand" | "twoHand" | "armor" | "bag" | "small";
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
  baseId: string;
  tier: number;
  slot: UpgradeSlot;
  family: UpgradeFamily;
  matCount: number;
  fromEnchant: 0 | 1 | 2;
  toEnchant: 1 | 2 | 3;
  mats: Array<{ kind: UpgradeMatKind; itemId: string; count: number }>;
};

/** Buy cities: 5 royal + Caerleon + Brecilien. */
export const UPGRADE_BUY_CITIES = [
  ...CITY_LOCATIONS,
  "Brecilien",
] as const;

export type UpgradeBuyCity = (typeof UPGRADE_BUY_CITIES)[number];
export type UpgradeBuyCityPref = "auto" | UpgradeBuyCity;

export type UpgradePathFilter = "all" | 1 | 2 | 3;

export type UpgradeIngredientQuote = {
  itemId: string;
  count: number;
  unitPrice: number;
  lineTotal: number;
  date: string;
  city: UpgradeBuyCity;
};

export type UpgradeOpportunity = {
  baseId: string;
  inputId: string;
  outputId: string;
  family: UpgradeFamily;
  slot: UpgradeSlot;
  tier: number;
  quality: number;
  fromEnchant: number;
  toEnchant: number;
  cost: number;
  bmBuy: number;
  bmBuyDate: string;
  ingredients: UpgradeIngredientQuote[];
  /** auto = mixed cities; else locked city used for all buys */
  buyCity: UpgradeBuyCityPref;
};

export const UPGRADE_RECIPES = recipesJson as UpgradeRecipe[];

const BUY_CITY_SET = new Set<string>(UPGRADE_BUY_CITIES);

export function withEnchant(baseId: string, enchant: number): string {
  return enchant > 0 ? `${baseId}@${enchant}` : baseId;
}

export function isUpgradeBuyCity(v: unknown): v is UpgradeBuyCity {
  return typeof v === "string" && BUY_CITY_SET.has(v);
}

export function isUpgradeBuyCityPref(v: unknown): v is UpgradeBuyCityPref {
  return v === "auto" || isUpgradeBuyCity(v);
}

type AskQuote = { price: number; date: string; city: UpgradeBuyCity };

type GearCell = {
  cityAsks: Map<string, AskQuote>;
  bmBuy: number;
  bmBuyDate: string;
};

type MatCell = Map<string, AskQuote>;

function buildIndexes(rows: AodpPriceRow[]): {
  gear: Map<string, GearCell>;
  mats: Map<string, MatCell>;
} {
  const gear = new Map<string, GearCell>();
  const mats = new Map<string, MatCell>();

  for (const row of rows) {
    if (!row.item_id) continue;
    const isMat = /_RUNE$|_SOUL$|_RELIC$/.test(row.item_id);
    const quality = row.quality || 1;

    if (isMat) {
      if (quality !== 1) continue;
      if (!BUY_CITY_SET.has(row.city) || !(row.sell_price_min > 0)) continue;
      let cell = mats.get(row.item_id);
      if (!cell) {
        cell = new Map();
        mats.set(row.item_id, cell);
      }
      const city = row.city as UpgradeBuyCity;
      const prev = cell.get(city);
      if (!prev || row.sell_price_min < prev.price) {
        cell.set(city, {
          price: row.sell_price_min,
          date: row.sell_price_min_date,
          city,
        });
      }
      continue;
    }

    const key = qualityKey(row.item_id, quality);
    let cell = gear.get(key);
    if (!cell) {
      cell = { cityAsks: new Map(), bmBuy: 0, bmBuyDate: "" };
      gear.set(key, cell);
    }
    if (BUY_CITY_SET.has(row.city) && row.sell_price_min > 0) {
      const city = row.city as UpgradeBuyCity;
      const prev = cell.cityAsks.get(city);
      if (!prev || row.sell_price_min < prev.price) {
        cell.cityAsks.set(city, {
          price: row.sell_price_min,
          date: row.sell_price_min_date,
          city,
        });
      }
    }
    if (row.city === BLACK_MARKET && row.buy_price_max > 0) {
      cell.bmBuy = row.buy_price_max;
      cell.bmBuyDate = row.buy_price_max_date;
    }
  }

  return { gear, mats };
}

function pickAsk(
  asks: Map<string, AskQuote> | undefined,
  buyCity: UpgradeBuyCityPref,
  freshness: { maxAgeMinutes: number; nowMs: number } | null,
): AskQuote | null {
  if (!asks || asks.size === 0) return null;
  const cities: UpgradeBuyCity[] =
    buyCity === "auto" ? [...UPGRADE_BUY_CITIES] : [buyCity];

  let best: AskQuote | null = null;
  for (const city of cities) {
    const q = asks.get(city);
    if (!q || !(q.price > 0)) continue;
    if (
      freshness &&
      !isFresh(q.date, freshness.maxAgeMinutes, freshness.nowMs)
    ) {
      continue;
    }
    if (!best || q.price < best.price) best = q;
  }
  return best;
}

export function upgradePriceItemIds(
  recipes: UpgradeRecipe[] = UPGRADE_RECIPES,
): string[] {
  const ids = new Set<string>();
  for (const r of recipes) {
    ids.add(withEnchant(r.baseId, r.fromEnchant));
    ids.add(withEnchant(r.baseId, r.toEnchant));
    for (const m of r.mats) ids.add(m.itemId);
  }
  return [...ids];
}

export type BuildUpgradeOptions = {
  buyCity?: UpgradeBuyCityPref;
  qualities?: number[];
  maxAgeMinutes?: number;
  nowMs?: number;
  recipes?: UpgradeRecipe[];
};

export function buildUpgradeFlips(
  rows: AodpPriceRow[],
  options: BuildUpgradeOptions = {},
): UpgradeOpportunity[] {
  const buyCity = options.buyCity ?? "auto";
  const qualities = options.qualities ?? [1, 2, 3, 4, 5];
  const recipes = options.recipes ?? UPGRADE_RECIPES;
  const freshness =
    options.maxAgeMinutes !== undefined
      ? {
          maxAgeMinutes: options.maxAgeMinutes,
          nowMs: options.nowMs ?? Date.now(),
        }
      : null;

  const { gear, mats } = buildIndexes(rows);
  const flips: UpgradeOpportunity[] = [];

  for (const recipe of recipes) {
    const inputId = withEnchant(recipe.baseId, recipe.fromEnchant);
    const outputId = withEnchant(recipe.baseId, recipe.toEnchant);

    for (const quality of qualities) {
      const inCell = gear.get(qualityKey(inputId, quality));
      const outCell = gear.get(qualityKey(outputId, quality));
      if (!outCell || !(outCell.bmBuy > 0)) continue;
      if (
        freshness &&
        !isFresh(outCell.bmBuyDate, freshness.maxAgeMinutes, freshness.nowMs)
      ) {
        continue;
      }

      const baseAsk = pickAsk(inCell?.cityAsks, buyCity, freshness);
      if (!baseAsk) continue;

      const quotes: UpgradeIngredientQuote[] = [
        {
          itemId: inputId,
          count: 1,
          unitPrice: baseAsk.price,
          lineTotal: baseAsk.price,
          date: baseAsk.date,
          city: baseAsk.city,
        },
      ];
      let cost = baseAsk.price;
      let matsOk = true;

      for (const mat of recipe.mats) {
        const matAsks = mats.get(mat.itemId);
        const ask = pickAsk(matAsks, buyCity, freshness);
        if (!ask) {
          matsOk = false;
          break;
        }
        const lineTotal = ask.price * mat.count;
        cost += lineTotal;
        quotes.push({
          itemId: mat.itemId,
          count: mat.count,
          unitPrice: ask.price,
          lineTotal,
          date: ask.date,
          city: ask.city,
        });
      }
      if (!matsOk) continue;

      flips.push({
        baseId: recipe.baseId,
        inputId,
        outputId,
        family: recipe.family,
        slot: recipe.slot,
        tier: recipe.tier,
        quality,
        fromEnchant: recipe.fromEnchant,
        toEnchant: recipe.toEnchant,
        cost,
        bmBuy: outCell.bmBuy,
        bmBuyDate: outCell.bmBuyDate,
        ingredients: quotes,
        buyCity,
      });
    }
  }

  return flips;
}

export function upgradeNet(bmBuy: number, taxRate: number): number {
  return netAfterTax(bmBuy, taxRate);
}

export function upgradeProfit(
  bmBuy: number,
  cost: number,
  taxRate: number,
): number {
  return calcProfit(bmBuy, cost, taxRate);
}

export function upgradeRoi(
  bmBuy: number,
  cost: number,
  taxRate: number,
): number {
  return calcRoi(bmBuy, cost, taxRate);
}

export type { CityLocation };
