import type { CityFilter, QualityFilter } from "@/components/SecondaryFilters";
import type { SortTab } from "@/components/SortTabs";
import { isItemQuality } from "@/lib/quality";
import { DEFAULT_PROFIT_THRESHOLD, PROFIT_THRESHOLDS } from "@/lib/thresholds";
import { CITY_LOCATIONS } from "@/lib/types";

export const STORAGE_KEY = "flipper-filters";
export const FILTER_PREFS_VERSION = 1;

const ALLOWED_MAX_AGES = [60, 180, 360, 720, 1440, 2880] as const;
const ALLOWED_TAX_RATES = [0.04, 0.08] as const;
const THRESHOLD_VALUES = new Set<number>(PROFIT_THRESHOLDS.map((t) => t.value));
const CITY_SET = new Set<string>(CITY_LOCATIONS);

export type FilterPrefs = {
  threshold: number;
  taxRate: number;
  maxAge: number;
  cityFilter: CityFilter;
  qualityFilter: QualityFilter;
  sortTab: SortTab;
};

export const DEFAULT_FILTER_PREFS: FilterPrefs = {
  threshold: DEFAULT_PROFIT_THRESHOLD,
  taxRate: 0.04,
  maxAge: 6 * 60,
  cityFilter: "all",
  qualityFilter: "all",
  sortTab: "profit",
};

type StoredPayload = {
  v?: number;
} & Partial<FilterPrefs>;

function isCityFilter(v: unknown): v is CityFilter {
  if (v === "all" || v === "royal") return true;
  return typeof v === "string" && CITY_SET.has(v);
}

function isQualityFilter(v: unknown): v is QualityFilter {
  if (v === "all") return true;
  return typeof v === "number" && isItemQuality(v);
}

function isSortTab(v: unknown): v is SortTab {
  return v === "profit" || v === "fresh";
}

function isThreshold(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && THRESHOLD_VALUES.has(v);
}

function isTaxRate(v: unknown): v is number {
  return typeof v === "number" && (ALLOWED_TAX_RATES as readonly number[]).includes(v);
}

function isMaxAge(v: unknown): v is number {
  return typeof v === "number" && (ALLOWED_MAX_AGES as readonly number[]).includes(v);
}

function parsePartial(raw: StoredPayload): FilterPrefs {
  return {
    threshold: isThreshold(raw.threshold) ? raw.threshold : DEFAULT_FILTER_PREFS.threshold,
    taxRate: isTaxRate(raw.taxRate) ? raw.taxRate : DEFAULT_FILTER_PREFS.taxRate,
    maxAge: isMaxAge(raw.maxAge) ? raw.maxAge : DEFAULT_FILTER_PREFS.maxAge,
    cityFilter: isCityFilter(raw.cityFilter) ? raw.cityFilter : DEFAULT_FILTER_PREFS.cityFilter,
    qualityFilter: isQualityFilter(raw.qualityFilter)
      ? raw.qualityFilter
      : DEFAULT_FILTER_PREFS.qualityFilter,
    sortTab: isSortTab(raw.sortTab) ? raw.sortTab : DEFAULT_FILTER_PREFS.sortTab,
  };
}

export function readStoredFilterPrefs(): FilterPrefs {
  if (typeof window === "undefined") return DEFAULT_FILTER_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTER_PREFS;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed.v !== FILTER_PREFS_VERSION) return DEFAULT_FILTER_PREFS;
    return parsePartial(parsed);
  } catch {
    return DEFAULT_FILTER_PREFS;
  }
}

export function writeStoredFilterPrefs(prefs: FilterPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredPayload = { v: FILTER_PREFS_VERSION, ...prefs };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}
