import type { RefineMarketCity } from "@/lib/types";
import { REFINE_CITIES } from "@/lib/types";
import type { DailyProductionBonus, MarketSide, RefineFamily } from "@/lib/refineFlips";

export const REFINE_STORAGE_KEY = "flipper-refine-filters";
/** v4: daily production bonus toggle. */
export const REFINE_FILTER_PREFS_VERSION = 4;

const ALLOWED_MAX_AGES = [60, 180, 360, 720, 1440, 2880] as const;
const ALLOWED_TAX_RATES = [0.04, 0.08] as const;
const ALLOWED_DAILY: readonly DailyProductionBonus[] = [0, 10, 20];
const FAMILIES = new Set<RefineFamily>([
  "bars",
  "planks",
  "cloth",
  "leather",
  "stone",
]);
const CITY_SET = new Set<string>(REFINE_CITIES);

export type RefineFamilyFilter = "all" | RefineFamily;
export type RefineCityPreference = "auto" | RefineMarketCity;

export type RefineFilterPrefs = {
  taxRate: number;
  maxAge: number;
  familyFilter: RefineFamilyFilter;
  buySide: MarketSide;
  sellSide: MarketSide;
  useFocus: boolean;
  dailyBonus: DailyProductionBonus;
  refineCity: RefineCityPreference;
};

export const DEFAULT_REFINE_FILTER_PREFS: RefineFilterPrefs = {
  taxRate: 0.04,
  maxAge: 6 * 60,
  familyFilter: "all",
  buySide: "instant",
  /** List after refine — buy-bid dump is not the usual refine path. */
  sellSide: "order",
  /** Serious refine uses focus; without it mid/high tiers look falsely dead. */
  useFocus: true,
  dailyBonus: 0,
  refineCity: "auto",
};

type StoredPayload = { v?: number } & Partial<RefineFilterPrefs>;

function isFamily(v: unknown): v is RefineFamilyFilter {
  return v === "all" || (typeof v === "string" && FAMILIES.has(v as RefineFamily));
}

function isSide(v: unknown): v is MarketSide {
  return v === "instant" || v === "order";
}

function isRefineCity(v: unknown): v is RefineCityPreference {
  return v === "auto" || (typeof v === "string" && CITY_SET.has(v));
}

function isDailyBonus(v: unknown): v is DailyProductionBonus {
  return typeof v === "number" && (ALLOWED_DAILY as readonly number[]).includes(v);
}

function isTaxRate(v: unknown): v is number {
  return typeof v === "number" && (ALLOWED_TAX_RATES as readonly number[]).includes(v);
}

function isMaxAge(v: unknown): v is number {
  return typeof v === "number" && (ALLOWED_MAX_AGES as readonly number[]).includes(v);
}

function parsePartial(raw: StoredPayload): RefineFilterPrefs {
  return {
    taxRate: isTaxRate(raw.taxRate) ? raw.taxRate : DEFAULT_REFINE_FILTER_PREFS.taxRate,
    maxAge: isMaxAge(raw.maxAge) ? raw.maxAge : DEFAULT_REFINE_FILTER_PREFS.maxAge,
    familyFilter: isFamily(raw.familyFilter)
      ? raw.familyFilter
      : DEFAULT_REFINE_FILTER_PREFS.familyFilter,
    buySide: isSide(raw.buySide) ? raw.buySide : DEFAULT_REFINE_FILTER_PREFS.buySide,
    sellSide: isSide(raw.sellSide) ? raw.sellSide : DEFAULT_REFINE_FILTER_PREFS.sellSide,
    useFocus: typeof raw.useFocus === "boolean" ? raw.useFocus : DEFAULT_REFINE_FILTER_PREFS.useFocus,
    dailyBonus: isDailyBonus(raw.dailyBonus)
      ? raw.dailyBonus
      : DEFAULT_REFINE_FILTER_PREFS.dailyBonus,
    refineCity: isRefineCity(raw.refineCity)
      ? raw.refineCity
      : DEFAULT_REFINE_FILTER_PREFS.refineCity,
  };
}

export function readStoredRefineFilterPrefs(): RefineFilterPrefs {
  if (typeof window === "undefined") return DEFAULT_REFINE_FILTER_PREFS;
  try {
    const raw = window.localStorage.getItem(REFINE_STORAGE_KEY);
    if (!raw) return DEFAULT_REFINE_FILTER_PREFS;
    const parsed = JSON.parse(raw) as StoredPayload;
    // Accept v3 (no daily) and v4 — migrate missing dailyBonus to 0.
    if (parsed.v !== 3 && parsed.v !== REFINE_FILTER_PREFS_VERSION) {
      return DEFAULT_REFINE_FILTER_PREFS;
    }
    return parsePartial(parsed);
  } catch {
    return DEFAULT_REFINE_FILTER_PREFS;
  }
}

export function writeStoredRefineFilterPrefs(prefs: RefineFilterPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REFINE_STORAGE_KEY,
      JSON.stringify({ v: REFINE_FILTER_PREFS_VERSION, ...prefs }),
    );
  } catch {
    /* ignore */
  }
}
