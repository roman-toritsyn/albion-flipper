import type { QualityFilter } from "@/components/SecondaryFilters";
import {
  isCraftBuyMode,
  type CraftBuyMode,
  type CraftFamily,
} from "@/lib/craftFlips";
import { isItemQuality } from "@/lib/quality";
import { DEFAULT_PROFIT_THRESHOLD, PROFIT_THRESHOLDS } from "@/lib/thresholds";

export const CRAFT_STORAGE_KEY = "flipper-craft-filters";
export const CRAFT_FILTER_PREFS_VERSION = 2;

const ALLOWED_MAX_AGES = [60, 180, 360, 720, 1440, 2880] as const;
const ALLOWED_TAX_RATES = [0.04, 0.08] as const;
const THRESHOLD_VALUES = new Set<number>(PROFIT_THRESHOLDS.map((t) => t.value));

export type CraftFamilyFilter = "all" | CraftFamily;

export type CraftFilterPrefs = {
  threshold: number;
  taxRate: number;
  maxAge: number;
  qualityFilter: QualityFilter;
  familyFilter: CraftFamilyFilter;
  buyMode: CraftBuyMode;
};

export const DEFAULT_CRAFT_FILTER_PREFS: CraftFilterPrefs = {
  threshold: DEFAULT_PROFIT_THRESHOLD,
  taxRate: 0.04,
  maxAge: 6 * 60,
  qualityFilter: "all",
  familyFilter: "all",
  buyMode: "royal",
};

type StoredPayload = { v?: number } & Partial<CraftFilterPrefs>;

function isQualityFilter(v: unknown): v is QualityFilter {
  if (v === "all") return true;
  return typeof v === "number" && isItemQuality(v);
}

function isFamilyFilter(v: unknown): v is CraftFamilyFilter {
  return v === "all" || v === "cape" || v === "royal";
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

function parsePartial(raw: StoredPayload): CraftFilterPrefs {
  // Migrate v1 lowercase "caerleon" → "Caerleon"
  let rawBuy: unknown = raw.buyMode;
  if (typeof rawBuy === "string" && rawBuy.toLowerCase() === "caerleon") {
    rawBuy = "Caerleon";
  }
  return {
    threshold: isThreshold(raw.threshold)
      ? raw.threshold
      : DEFAULT_CRAFT_FILTER_PREFS.threshold,
    taxRate: isTaxRate(raw.taxRate) ? raw.taxRate : DEFAULT_CRAFT_FILTER_PREFS.taxRate,
    maxAge: isMaxAge(raw.maxAge) ? raw.maxAge : DEFAULT_CRAFT_FILTER_PREFS.maxAge,
    qualityFilter: isQualityFilter(raw.qualityFilter)
      ? raw.qualityFilter
      : DEFAULT_CRAFT_FILTER_PREFS.qualityFilter,
    familyFilter: isFamilyFilter(raw.familyFilter)
      ? raw.familyFilter
      : DEFAULT_CRAFT_FILTER_PREFS.familyFilter,
    buyMode: isCraftBuyMode(rawBuy) ? rawBuy : DEFAULT_CRAFT_FILTER_PREFS.buyMode,
  };
}

export function readStoredCraftFilterPrefs(): CraftFilterPrefs {
  if (typeof window === "undefined") return DEFAULT_CRAFT_FILTER_PREFS;
  try {
    const raw = window.localStorage.getItem(CRAFT_STORAGE_KEY);
    if (!raw) return DEFAULT_CRAFT_FILTER_PREFS;
    const parsed = JSON.parse(raw) as StoredPayload;
    // v1 used buyMode "royal" | "caerleon" — still parseable via migration
    if (parsed.v !== 1 && parsed.v !== CRAFT_FILTER_PREFS_VERSION) {
      return DEFAULT_CRAFT_FILTER_PREFS;
    }
    return parsePartial(parsed);
  } catch {
    return DEFAULT_CRAFT_FILTER_PREFS;
  }
}

export function writeStoredCraftFilterPrefs(prefs: CraftFilterPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CRAFT_STORAGE_KEY,
      JSON.stringify({ v: CRAFT_FILTER_PREFS_VERSION, ...prefs }),
    );
  } catch {
    /* ignore */
  }
}
