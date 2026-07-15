export const CITY_LOCATIONS = [
  "Bridgewatch",
  "Martlock",
  "Thetford",
  "Fort Sterling",
  "Lymhurst",
  "Caerleon",
] as const;

export type CityLocation = (typeof CITY_LOCATIONS)[number];

/** Royal cities only (without Caerleon). */
export const ROYAL_CITIES = [
  "Bridgewatch",
  "Martlock",
  "Thetford",
  "Fort Sterling",
  "Lymhurst",
] as const satisfies readonly CityLocation[];

export type RoyalCity = (typeof ROYAL_CITIES)[number];

/**
 * Cities used for refine buy/sell/refine city picks.
 * Royal 5 + Brecilien (same base RRR as royal without specialty). No Caerleon.
 */
export const REFINE_CITIES = [
  ...ROYAL_CITIES,
  "Brecilien",
] as const;

export type RefineMarketCity = (typeof REFINE_CITIES)[number];

export const BLACK_MARKET = "Black Market" as const;

export type MarketLocation = CityLocation | typeof BLACK_MARKET;

export type FlipKind = "local" | "remote";

/** Raw row from AODP /api/v2/stats/prices */
export type AodpPriceRow = {
  item_id: string;
  city: string;
  quality: number;
  sell_price_min: number;
  sell_price_min_date: string;
  sell_price_max: number;
  sell_price_max_date: string;
  buy_price_min: number;
  buy_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
};

/** Flip opportunity sent to the client (prices only; tax applied client-side). */
export type FlipOpportunity = {
  itemId: string;
  /** Albion item quality 1–5 (Normal → Masterpiece). Matched city↔BM. */
  quality: number;
  city: CityLocation;
  citySell: number;
  citySellDate: string;
  bmBuy: number;
  bmBuyDate: string;
  kind: FlipKind;
};

export type FlipsResponse = {
  flips: FlipOpportunity[];
  fetchedAt: number;
  expiresAt: number;
  cacheHit: boolean;
};

/** Craft flip (city ingredients → BM). Tax applied client-side. */
export type CraftFlipDto = {
  outputId: string;
  family: "cape" | "royal";
  quality: number;
  enchant: number;
  cost: number;
  bmBuy: number;
  bmBuyDate: string;
  ingredients: Array<{
    itemId: string;
    count: number;
    unitPrice: number;
    lineTotal: number;
    date: string;
    city: string;
  }>;
  alternativeIndex: number;
  buyMode: "royal" | CityLocation;
};

export type CraftFlipsByModeDto = {
  [K in "royal" | CityLocation]: CraftFlipDto[];
};

export type CraftFlipsResponse = {
  flipsByMode: CraftFlipsByModeDto;
  fetchedAt: number;
  expiresAt: number;
  cacheHit: boolean;
};

/** Raw AODP rows for refine (client rebuilds flips when buy/sell/focus change). */
export type RefineFlipsResponse = {
  rows: AodpPriceRow[];
  fetchedAt: number;
  expiresAt: number;
  cacheHit: boolean;
};
