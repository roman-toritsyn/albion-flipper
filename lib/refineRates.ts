import type { RefineMarketCity, RoyalCity } from "./types";
import { REFINE_CITIES } from "./types";

export type RefineFamily = "bars" | "planks" | "cloth" | "leather" | "stone";

/** Daily production bonus from Activities (+0 / +10 / +20). */
export type DailyProductionBonus = 0 | 10 | 20;

/** City with +40% refining specialty for this family. */
export const REFINE_SPECIALTY_CITY: Record<RefineFamily, RoyalCity> = {
  bars: "Thetford",
  planks: "Fort Sterling",
  cloth: "Lymhurst",
  leather: "Martlock",
  stone: "Bridgewatch",
};

/** Royal city / Brecilien base refining production bonus. */
export const REFINE_CITY_BASE_BONUS = 18;
/** Specialty resource refining bonus (+40% production bonus). */
export const REFINE_SPECIALTY_BONUS = 40;
/** Focus production bonus flat add. */
export const REFINE_FOCUS_BONUS = 59;

/**
 * Resource return rates without daily bonus (wiki table).
 * Kept for reference / backward-compatible smoke checks.
 */
export type RefineRateProfile = {
  base: number;
  specialty: number;
};

export const REFINE_RRR = {
  noFocus: { base: 0.153, specialty: 0.367 } satisfies RefineRateProfile,
  focus: { base: 0.435, specialty: 0.539 } satisfies RefineRateProfile,
} as const;

export function isRefineCity(city: string): city is RefineMarketCity {
  return (REFINE_CITIES as readonly string[]).includes(city);
}

export function specialtyCityFor(family: RefineFamily): RoyalCity {
  return REFINE_SPECIALTY_CITY[family];
}

/** RRR = productionBonus / (100 + productionBonus). */
export function rrrFromProductionBonus(productionBonus: number): number {
  if (!(productionBonus > 0)) return 0;
  return productionBonus / (100 + productionBonus);
}

export function refineProductionBonus(
  family: RefineFamily,
  refineCity: RefineMarketCity,
  useFocus: boolean,
  dailyBonus: DailyProductionBonus = 0,
): number {
  let bonus = REFINE_CITY_BASE_BONUS;
  if (refineCity === REFINE_SPECIALTY_CITY[family]) {
    bonus += REFINE_SPECIALTY_BONUS;
  }
  if (useFocus) bonus += REFINE_FOCUS_BONUS;
  bonus += dailyBonus;
  return bonus;
}

export function resourceReturnRate(
  family: RefineFamily,
  refineCity: RefineMarketCity,
  useFocus: boolean,
  dailyBonus: DailyProductionBonus = 0,
): number {
  return rrrFromProductionBonus(
    refineProductionBonus(family, refineCity, useFocus, dailyBonus),
  );
}
