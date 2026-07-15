import recipesJson from "../data/craft-recipes.json";
import { netAfterTax, profit as calcProfit, roi as calcRoi } from "./calc";
import { qualityKey } from "./quality";
import type { AodpPriceRow, CityLocation } from "./types";
import { BLACK_MARKET, CITY_LOCATIONS, ROYAL_CITIES } from "./types";

export type CraftFamily = "cape" | "royal";

/**
 * Where to buy craft ingredients.
 * - royal: cheapest among the 5 royal cities
 * - CityLocation: that city only
 */
export type CraftBuyMode = "royal" | CityLocation;

export const CRAFT_BUY_MODES: readonly CraftBuyMode[] = [
  "royal",
  ...CITY_LOCATIONS,
] as const;

export type CraftIngredient = {
  itemId: string;
  count: number;
};

export type CraftRecipe = {
  outputId: string;
  enchant: number;
  family: CraftFamily;
  alternatives: Array<{ ingredients: CraftIngredient[] }>;
};

export type CraftIngredientQuote = {
  itemId: string;
  count: number;
  unitPrice: number;
  lineTotal: number;
  date: string;
  /** City chosen for this ingredient under the active buy mode. */
  city: string;
};

export type CraftFlipOpportunity = {
  outputId: string;
  family: CraftFamily;
  quality: number;
  enchant: number;
  cost: number;
  bmBuy: number;
  bmBuyDate: string;
  ingredients: CraftIngredientQuote[];
  alternativeIndex: number;
  buyMode: CraftBuyMode;
};

export type CraftFlipsByMode = { [K in CraftBuyMode]: CraftFlipOpportunity[] };

export const CRAFT_RECIPES = recipesJson as CraftRecipe[];

const CITY_SET = new Set<string>(CITY_LOCATIONS);
const ROYAL_SET = new Set<string>(ROYAL_CITIES);

type CityQuote = {
  price: number;
  date: string;
  city: string;
};

type PriceCell = {
  citySells: Map<string, CityQuote>;
  bmBuy: number;
  bmBuyDate: string;
};

export function isCraftBuyMode(v: unknown): v is CraftBuyMode {
  return (
    v === "royal" || (typeof v === "string" && CITY_SET.has(v))
  );
}

export function allowedCitiesFor(buyMode: CraftBuyMode): Set<string> {
  if (buyMode === "royal") return ROYAL_SET;
  return new Set([buyMode]);
}

function buildPriceIndex(rows: AodpPriceRow[]): Map<string, PriceCell> {
  const map = new Map<string, PriceCell>();

  for (const row of rows) {
    if (!row.item_id) continue;
    const quality = row.quality || 1;
    const key = qualityKey(row.item_id, quality);
    let cell = map.get(key);
    if (!cell) {
      cell = {
        citySells: new Map(),
        bmBuy: 0,
        bmBuyDate: "",
      };
      map.set(key, cell);
    }

    if (CITY_SET.has(row.city) && row.sell_price_min > 0) {
      const prev = cell.citySells.get(row.city);
      if (!prev || row.sell_price_min < prev.price) {
        cell.citySells.set(row.city, {
          price: row.sell_price_min,
          date: row.sell_price_min_date,
          city: row.city,
        });
      }
    }
    if (row.city === BLACK_MARKET && row.buy_price_max > 0) {
      cell.bmBuy = row.buy_price_max;
      cell.bmBuyDate = row.buy_price_max_date;
    }
  }

  return map;
}

function cheapestInCities(
  cell: PriceCell | undefined,
  allowedCities: Set<string>,
): CityQuote | null {
  if (!cell || cell.citySells.size === 0) return null;
  let best: CityQuote | null = null;
  for (const quote of cell.citySells.values()) {
    if (!allowedCities.has(quote.city)) continue;
    if (!best || quote.price < best.price) best = quote;
  }
  return best;
}

function citySellForMode(
  itemId: string,
  quality: number,
  prices: Map<string, PriceCell>,
  buyMode: CraftBuyMode,
): CityQuote | null {
  const allowed = allowedCitiesFor(buyMode);
  const tryQuality = (q: number): CityQuote | null =>
    cheapestInCities(prices.get(qualityKey(itemId, q)), allowed);

  return tryQuality(quality) ?? (quality !== 1 ? tryQuality(1) : null);
}

function costAlternative(
  ingredients: CraftIngredient[],
  quality: number,
  prices: Map<string, PriceCell>,
  buyMode: CraftBuyMode,
): { cost: number; quotes: CraftIngredientQuote[] } | null {
  const quotes: CraftIngredientQuote[] = [];
  let cost = 0;

  for (const ing of ingredients) {
    const sell = citySellForMode(ing.itemId, quality, prices, buyMode);
    if (!sell) return null;
    const lineTotal = sell.price * ing.count;
    cost += lineTotal;
    quotes.push({
      itemId: ing.itemId,
      count: ing.count,
      unitPrice: sell.price,
      lineTotal,
      date: sell.date,
      city: sell.city,
    });
  }

  return { cost, quotes };
}

/** Collect all unique item ids referenced by craft recipes. */
export function craftPriceItemIds(recipes: CraftRecipe[] = CRAFT_RECIPES): string[] {
  const ids = new Set<string>();
  for (const r of recipes) {
    ids.add(r.outputId);
    for (const alt of r.alternatives) {
      for (const ing of alt.ingredients) ids.add(ing.itemId);
    }
  }
  return [...ids];
}

/**
 * Build craft flips for one buy mode.
 * Sell finished item on Black Market.
 */
function buildCraftFlipsFromIndex(
  prices: Map<string, PriceCell>,
  recipes: CraftRecipe[],
  qualities: number[],
  buyMode: CraftBuyMode,
): CraftFlipOpportunity[] {
  const flips: CraftFlipOpportunity[] = [];

  for (const recipe of recipes) {
    for (const quality of qualities) {
      const outCell = prices.get(qualityKey(recipe.outputId, quality));
      if (!outCell || !(outCell.bmBuy > 0)) continue;

      let best: {
        cost: number;
        quotes: CraftIngredientQuote[];
        alternativeIndex: number;
      } | null = null;

      for (let i = 0; i < recipe.alternatives.length; i++) {
        const priced = costAlternative(
          recipe.alternatives[i].ingredients,
          quality,
          prices,
          buyMode,
        );
        if (!priced) continue;
        if (!best || priced.cost < best.cost) {
          best = { ...priced, alternativeIndex: i };
        }
      }

      if (!best) continue;

      flips.push({
        outputId: recipe.outputId,
        family: recipe.family,
        quality,
        enchant: recipe.enchant,
        cost: best.cost,
        bmBuy: outCell.bmBuy,
        bmBuyDate: outCell.bmBuyDate,
        ingredients: best.quotes,
        alternativeIndex: best.alternativeIndex,
        buyMode,
      });
    }
  }

  return flips;
}

export function buildCraftFlips(
  rows: AodpPriceRow[],
  recipes: CraftRecipe[] = CRAFT_RECIPES,
  qualities: number[] = [1, 2, 3, 4, 5],
  buyMode: CraftBuyMode = "royal",
): CraftFlipOpportunity[] {
  return buildCraftFlipsFromIndex(buildPriceIndex(rows), recipes, qualities, buyMode);
}

/** Compute all buy-mode flip lists from the same price rows (one index). */
export function buildCraftFlipsByMode(
  rows: AodpPriceRow[],
  recipes: CraftRecipe[] = CRAFT_RECIPES,
  qualities: number[] = [1, 2, 3, 4, 5],
): CraftFlipsByMode {
  const prices = buildPriceIndex(rows);
  const out = {} as CraftFlipsByMode;
  for (const mode of CRAFT_BUY_MODES) {
    out[mode] = buildCraftFlipsFromIndex(prices, recipes, qualities, mode);
  }
  return out;
}

/** Convenience: royal cheapest + Caerleon-only. */
export function buildCraftFlipsBoth(
  rows: AodpPriceRow[],
  recipes: CraftRecipe[] = CRAFT_RECIPES,
  qualities: number[] = [1, 2, 3, 4, 5],
): { royal: CraftFlipOpportunity[]; caerleon: CraftFlipOpportunity[] } {
  const by = buildCraftFlipsByMode(rows, recipes, qualities);
  return { royal: by.royal, caerleon: by.Caerleon };
}

export function craftNet(bmBuy: number, taxRate: number): number {
  return netAfterTax(bmBuy, taxRate);
}

export function craftProfit(bmBuy: number, cost: number, taxRate: number): number {
  return calcProfit(bmBuy, cost, taxRate);
}

export function craftRoi(bmBuy: number, cost: number, taxRate: number): number {
  return calcRoi(bmBuy, cost, taxRate);
}

export type { CityLocation };
