import recipesJson from "../data/refine-recipes.json";
import {
  isFresh,
  netAfterTax,
  profit as calcProfit,
  roi as calcRoi,
} from "./calc";
import { fromAodpMarketId } from "./aodpItemIds";
import {
  resourceReturnRate,
  specialtyCityFor,
  type DailyProductionBonus,
  type RefineFamily,
} from "./refineRates";
import {
  refineNutrition,
  refineStationFee,
} from "./refineStationFee";
import type { AodpPriceRow, RefineMarketCity } from "./types";
import { REFINE_CITIES } from "./types";

export type { RefineFamily, DailyProductionBonus };

export type RefineIngredient = { itemId: string; count: number };

export type RefineRecipe = {
  outputId: string;
  enchant: number;
  tier: number;
  family: RefineFamily;
  alternatives: Array<{ ingredients: RefineIngredient[] }>;
};

export type MarketSide = "instant" | "order";

export type RefineIngredientQuote = {
  itemId: string;
  count: number;
  unitPrice: number;
  lineTotal: number;
  date: string;
  city: RefineMarketCity;
};

export type RefineOpportunity = {
  outputId: string;
  family: RefineFamily;
  tier: number;
  enchant: number;
  refineCity: RefineMarketCity;
  rrr: number;
  useFocus: boolean;
  dailyBonus: DailyProductionBonus;
  buySide: MarketSide;
  sellSide: MarketSide;
  /** Sum of ingredient line totals before RRR. */
  grossCost: number;
  /** grossCost × (1 − RRR) */
  effectiveCost: number;
  /** Nutrition consumed for this craft (Item Value × 0.1125). */
  nutrition: number;
  /** Station usage fee in silver (not reduced by RRR). */
  stationFee: number;
  revenue: number;
  revenueCity: RefineMarketCity;
  revenueDate: string;
  ingredients: RefineIngredientQuote[];
  alternativeIndex: number;
};

export const REFINE_RECIPES = recipesJson as RefineRecipe[];

/** Royal 5 + Brecilien; never Caerleon. */
const CITY_SET = new Set<string>(REFINE_CITIES);

type CityQuote = {
  instant: number; // sell_price_min — buy from market / list sell order
  instantDate: string;
  order: number; // buy_price_max — buy order / instant sell into buys
  orderDate: string;
};

type PriceCell = Map<RefineMarketCity, CityQuote>;

function pickPrice(
  quote: CityQuote,
  side: MarketSide,
  role: "buy" | "sell",
): { price: number; date: string } | null {
  // buy instant = sell_price_min; buy order = buy_price_max
  // sell instant = buy_price_max; sell order = sell_price_min
  if (role === "buy") {
    if (side === "instant") {
      return quote.instant > 0
        ? { price: quote.instant, date: quote.instantDate }
        : null;
    }
    return quote.order > 0 ? { price: quote.order, date: quote.orderDate } : null;
  }
  if (side === "instant") {
    return quote.order > 0 ? { price: quote.order, date: quote.orderDate } : null;
  }
  return quote.instant > 0
    ? { price: quote.instant, date: quote.instantDate }
    : null;
}

function buildPriceIndex(rows: AodpPriceRow[]): Map<string, PriceCell> {
  const map = new Map<string, PriceCell>();

  for (const row of rows) {
    if (!row.item_id || !CITY_SET.has(row.city)) continue;
    const city = row.city as RefineMarketCity;
    // Resources are quality 1 listings
    if ((row.quality || 1) !== 1) continue;

    const itemId = fromAodpMarketId(row.item_id);
    let cell = map.get(itemId);
    if (!cell) {
      cell = new Map();
      map.set(itemId, cell);
    }
    const prev = cell.get(city) ?? {
      instant: 0,
      instantDate: "",
      order: 0,
      orderDate: "",
    };
    if (row.sell_price_min > 0) {
      if (!prev.instant || row.sell_price_min < prev.instant) {
        prev.instant = row.sell_price_min;
        prev.instantDate = row.sell_price_min_date;
      }
    }
    if (row.buy_price_max > 0) {
      if (!prev.order || row.buy_price_max > prev.order) {
        prev.order = row.buy_price_max;
        prev.orderDate = row.buy_price_max_date;
      }
    }
    cell.set(city, prev);
  }

  return map;
}

type Freshness = { maxAgeMinutes: number; nowMs: number } | null;

function quoteFresh(
  date: string,
  freshness: Freshness,
): boolean {
  if (!freshness) return true;
  return isFresh(date, freshness.maxAgeMinutes, freshness.nowMs);
}

function bestBuy(
  itemId: string,
  prices: Map<string, PriceCell>,
  buySide: MarketSide,
  freshness: Freshness = null,
): { price: number; date: string; city: RefineMarketCity } | null {
  const cell = prices.get(itemId);
  if (!cell) return null;
  let best: { price: number; date: string; city: RefineMarketCity } | null = null;
  for (const city of REFINE_CITIES) {
    const q = cell.get(city);
    if (!q) continue;
    const picked = pickPrice(q, buySide, "buy");
    if (!picked) continue;
    if (!quoteFresh(picked.date, freshness)) continue;
    // Order-buy needs a believable local market: bid without ask, or bid far
    // below ask, is a phantom quote that invents refine profit.
    if (buySide === "order") {
      if (!(q.instant > 0) || picked.price < q.instant * 0.75) continue;
    }
    if (!best || picked.price < best.price) {
      best = { ...picked, city };
    }
  }
  return best;
}

function bestSell(
  itemId: string,
  prices: Map<string, PriceCell>,
  sellSide: MarketSide,
  freshness: Freshness = null,
): { price: number; date: string; city: RefineMarketCity } | null {
  const cell = prices.get(itemId);
  if (!cell) return null;
  let best: { price: number; date: string; city: RefineMarketCity } | null = null;
  for (const city of REFINE_CITIES) {
    const q = cell.get(city);
    if (!q) continue;
    const picked = pickPrice(q, sellSide, "sell");
    if (!picked) continue;
    if (!quoteFresh(picked.date, freshness)) continue;
    if (!best || picked.price > best.price) {
      best = { ...picked, city };
    }
  }
  return best;
}

/** Prefer listing/selling where you refine; fall back to best city if no quote. */
function sellForRefine(
  itemId: string,
  prices: Map<string, PriceCell>,
  sellSide: MarketSide,
  refineCity: RefineMarketCity,
  freshness: Freshness = null,
): { price: number; date: string; city: RefineMarketCity } | null {
  const cell = prices.get(itemId);
  if (!cell) return null;
  const local = cell.get(refineCity);
  if (local) {
    const picked = pickPrice(local, sellSide, "sell");
    if (picked && quoteFresh(picked.date, freshness)) {
      return { ...picked, city: refineCity };
    }
  }
  return bestSell(itemId, prices, sellSide, freshness);
}

export function refinePriceItemIds(
  recipes: RefineRecipe[] = REFINE_RECIPES,
): string[] {
  const ids = new Set<string>();
  for (const r of recipes) {
    ids.add(r.outputId);
    for (const alt of r.alternatives) {
      for (const ing of alt.ingredients) ids.add(ing.itemId);
    }
  }
  return [...ids];
}

export type BuildRefineOptions = {
  buySide?: MarketSide;
  sellSide?: MarketSide;
  useFocus?: boolean;
  /** Activities daily production bonus (+0 / +10 / +20). */
  dailyBonus?: DailyProductionBonus;
  /** Override refine city; default = specialty for family */
  refineCity?: RefineMarketCity | "auto";
  /** Skip alternatives that need faction/quest tokens */
  marketOnly?: boolean;
  /**
   * When set, only quotes within this age are considered for best buy/sell.
   * Avoids picking a stale “cheap” buy order that then fails the UI age filter.
   */
  maxAgeMinutes?: number;
  nowMs?: number;
  /** Station usage fee: silver per 100 nutrition (in-game building setting). */
  stationFeePer100?: number;
};

function isTokenAlt(ingredients: RefineIngredient[]): boolean {
  return ingredients.some(
    (i) =>
      i.itemId.includes("FACTION") ||
      i.itemId.includes("TOKEN") ||
      i.itemId.includes("QUESTITEM"),
  );
}

/**
 * Build refine opportunities: buy inputs across cities → refine in city with RRR → sell output.
 */
export function buildRefineFlips(
  rows: AodpPriceRow[],
  recipes: RefineRecipe[] = REFINE_RECIPES,
  options: BuildRefineOptions = {},
): RefineOpportunity[] {
  const buySide = options.buySide ?? "instant";
  const sellSide = options.sellSide ?? "order";
  const useFocus = options.useFocus ?? true;
  const dailyBonus = options.dailyBonus ?? 0;
  const marketOnly = options.marketOnly ?? true;
  const stationFeePer100 = options.stationFeePer100 ?? 0;
  const freshness: Freshness =
    options.maxAgeMinutes !== undefined
      ? {
          maxAgeMinutes: options.maxAgeMinutes,
          nowMs: options.nowMs ?? Date.now(),
        }
      : null;
  const prices = buildPriceIndex(rows);
  const flips: RefineOpportunity[] = [];

  for (const recipe of recipes) {
    const refineCity =
      options.refineCity &&
      options.refineCity !== "auto" &&
      CITY_SET.has(options.refineCity)
        ? options.refineCity
        : specialtyCityFor(recipe.family);
    const rrr = resourceReturnRate(
      recipe.family,
      refineCity,
      useFocus,
      dailyBonus,
    );

    const sell = sellForRefine(
      recipe.outputId,
      prices,
      sellSide,
      refineCity,
      freshness,
    );
    if (!sell) continue;

    let best: {
      grossCost: number;
      quotes: RefineIngredientQuote[];
      alternativeIndex: number;
    } | null = null;

    for (let i = 0; i < recipe.alternatives.length; i++) {
      const alt = recipe.alternatives[i];
      if (marketOnly && isTokenAlt(alt.ingredients)) continue;

      const quotes: RefineIngredientQuote[] = [];
      let grossCost = 0;
      let ok = true;
      for (const ing of alt.ingredients) {
        const buy = bestBuy(ing.itemId, prices, buySide, freshness);
        if (!buy) {
          ok = false;
          break;
        }
        const lineTotal = buy.price * ing.count;
        grossCost += lineTotal;
        quotes.push({
          itemId: ing.itemId,
          count: ing.count,
          unitPrice: buy.price,
          lineTotal,
          date: buy.date,
          city: buy.city,
        });
      }
      if (!ok) continue;
      if (!best || grossCost < best.grossCost) {
        best = { grossCost, quotes, alternativeIndex: i };
      }
    }

    if (!best) continue;

    const nutrition = refineNutrition(recipe.tier, recipe.enchant);
    const stationFee = refineStationFee(
      recipe.tier,
      recipe.enchant,
      stationFeePer100,
    );

    flips.push({
      outputId: recipe.outputId,
      family: recipe.family,
      tier: recipe.tier,
      enchant: recipe.enchant,
      refineCity,
      rrr,
      useFocus,
      dailyBonus,
      buySide,
      sellSide,
      grossCost: best.grossCost,
      effectiveCost: best.grossCost * (1 - rrr),
      nutrition,
      stationFee,
      revenue: sell.price,
      revenueCity: sell.city,
      revenueDate: sell.date,
      ingredients: best.quotes,
      alternativeIndex: best.alternativeIndex,
    });
  }

  return flips;
}

/** First non-token alternative ingredients, or null. */
export function marketIngredients(
  recipe: RefineRecipe,
): RefineIngredient[] | null {
  for (const alt of recipe.alternatives) {
    if (!isTokenAlt(alt.ingredients)) return alt.ingredients;
  }
  return null;
}

/**
 * Best-effort market quotes for the manual calculator.
 * Fills each ingredient / sell independently — unlike buildRefineFlips,
 * does not require a complete recipe (enchanted mats often miss one side).
 */
export function marketFillForRecipe(
  rows: AodpPriceRow[],
  recipe: RefineRecipe,
  options: BuildRefineOptions = {},
): { unitPrices: Record<string, number>; sellPrice: number | null } {
  const buySide = options.buySide ?? "instant";
  const sellSide = options.sellSide ?? "order";
  const freshness: Freshness =
    options.maxAgeMinutes !== undefined
      ? {
          maxAgeMinutes: options.maxAgeMinutes,
          nowMs: options.nowMs ?? Date.now(),
        }
      : null;
  const prices = buildPriceIndex(rows);
  const refineCity =
    options.refineCity &&
    options.refineCity !== "auto" &&
    CITY_SET.has(options.refineCity)
      ? options.refineCity
      : specialtyCityFor(recipe.family);

  const unitPrices: Record<string, number> = {};
  const ingredients = marketIngredients(recipe) ?? [];
  for (const ing of ingredients) {
    const buy = bestBuy(ing.itemId, prices, buySide, freshness);
    if (buy) unitPrices[ing.itemId] = buy.price;
  }

  const sell = sellForRefine(
    recipe.outputId,
    prices,
    sellSide,
    refineCity,
    freshness,
  );

  return {
    unitPrices,
    sellPrice: sell ? sell.price : null,
  };
}

export type ManualRefineResult = {
  refineCity: RefineMarketCity;
  rrr: number;
  ingredients: Array<{
    itemId: string;
    count: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  grossCost: number;
  effectiveCost: number;
  nutrition: number;
  stationFee: number;
  revenue: number;
  net: number;
  profit: number;
  roi: number;
  /** All unit prices and sell price are > 0 */
  complete: boolean;
};

/**
 * Manual refine math: user-entered unit prices × RRR vs sell price.
 */
export function calcManualRefine(options: {
  recipe: RefineRecipe;
  unitPrices: Record<string, number>;
  sellPrice: number;
  refineCity?: RefineMarketCity | "auto";
  useFocus?: boolean;
  dailyBonus?: DailyProductionBonus;
  taxRate?: number;
  stationFeePer100?: number;
}): ManualRefineResult | null {
  const ingredients = marketIngredients(options.recipe);
  if (!ingredients) return null;

  const refineCity =
    options.refineCity &&
    options.refineCity !== "auto" &&
    CITY_SET.has(options.refineCity)
      ? options.refineCity
      : specialtyCityFor(options.recipe.family);
  const useFocus = options.useFocus ?? true;
  const dailyBonus = options.dailyBonus ?? 0;
  const taxRate = options.taxRate ?? 0.04;
  const stationFeePer100 = options.stationFeePer100 ?? 0;
  const rrr = resourceReturnRate(
    options.recipe.family,
    refineCity,
    useFocus,
    dailyBonus,
  );

  const lines: ManualRefineResult["ingredients"] = [];
  let grossCost = 0;
  let complete = options.sellPrice > 0;
  for (const ing of ingredients) {
    const unitPrice = Number(options.unitPrices[ing.itemId] ?? 0);
    if (!(unitPrice > 0)) complete = false;
    const lineTotal = unitPrice * ing.count;
    grossCost += lineTotal;
    lines.push({
      itemId: ing.itemId,
      count: ing.count,
      unitPrice,
      lineTotal,
    });
  }

  const effectiveCost = grossCost * (1 - rrr);
  const nutrition = refineNutrition(
    options.recipe.tier,
    options.recipe.enchant,
  );
  const stationFee = refineStationFee(
    options.recipe.tier,
    options.recipe.enchant,
    stationFeePer100,
  );
  const revenue = Number(options.sellPrice) || 0;
  const net = netAfterTax(revenue, taxRate);
  const profit = refineProfit(revenue, effectiveCost, taxRate, stationFee);
  const roi = refineRoi(revenue, effectiveCost, taxRate, stationFee);

  return {
    refineCity,
    rrr,
    ingredients: lines,
    grossCost,
    effectiveCost,
    nutrition,
    stationFee,
    revenue,
    net,
    profit,
    roi,
    complete,
  };
}

export function refineNet(revenue: number, taxRate: number): number {
  return netAfterTax(revenue, taxRate);
}

/** Material cost after RRR + station fee (fee is not RRR-scaled). */
export function refineTotalCost(
  effectiveCost: number,
  stationFee: number = 0,
): number {
  return effectiveCost + Math.max(0, stationFee);
}

export function refineProfit(
  revenue: number,
  effectiveCost: number,
  taxRate: number,
  stationFee: number = 0,
): number {
  return calcProfit(revenue, refineTotalCost(effectiveCost, stationFee), taxRate);
}

export function refineRoi(
  revenue: number,
  effectiveCost: number,
  taxRate: number,
  stationFee: number = 0,
): number {
  return calcRoi(revenue, refineTotalCost(effectiveCost, stationFee), taxRate);
}
