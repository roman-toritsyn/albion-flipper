import {
  isUpgradeBuyCityPref,
  type UpgradeBuyCityPref,
  type UpgradeFamily,
  type UpgradePathFilter,
} from "@/lib/upgradeFlips";
import { isItemQuality } from "@/lib/quality";
import { DEFAULT_PROFIT_THRESHOLD, PROFIT_THRESHOLDS } from "@/lib/thresholds";

export const UPGRADE_STORAGE_KEY = "flipper-upgrade-filters";
export const UPGRADE_FILTER_PREFS_VERSION = 2;

const ALLOWED_MAX_AGES = [60, 180, 360, 720, 1440, 2880] as const;
const ALLOWED_TAX_RATES = [0.04, 0.08] as const;
const THRESHOLD_VALUES = new Set<number>(PROFIT_THRESHOLDS.map((t) => t.value));
const FAMILIES = new Set<UpgradeFamily>([
  "weapon",
  "armor",
  "head",
  "shoes",
  "offhand",
  "cape",
  "bag",
]);

export type UpgradeFamilyFilter = "all" | UpgradeFamily;
export type UpgradeQualityFilter = "all" | 1 | 2 | 3 | 4 | 5;

export type UpgradeFilterPrefs = {
  threshold: number;
  taxRate: number;
  maxAge: number;
  qualityFilter: UpgradeQualityFilter;
  familyFilter: UpgradeFamilyFilter;
  pathFilter: UpgradePathFilter;
  buyCity: UpgradeBuyCityPref;
};

export const DEFAULT_UPGRADE_FILTER_PREFS: UpgradeFilterPrefs = {
  threshold: DEFAULT_PROFIT_THRESHOLD,
  taxRate: 0.04,
  maxAge: 6 * 60,
  qualityFilter: "all",
  familyFilter: "all",
  pathFilter: "all",
  buyCity: "auto",
};

type StoredPayload = { v?: number } & Partial<UpgradeFilterPrefs>;

function isQualityFilter(v: unknown): v is UpgradeQualityFilter {
  if (v === "all") return true;
  return typeof v === "number" && isItemQuality(v);
}

function isFamilyFilter(v: unknown): v is UpgradeFamilyFilter {
  return v === "all" || (typeof v === "string" && FAMILIES.has(v as UpgradeFamily));
}

function isPathFilter(v: unknown): v is UpgradePathFilter {
  return v === "all" || v === 1 || v === 2 || v === 3;
}

function isThreshold(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && THRESHOLD_VALUES.has(v);
}

function isTaxRate(v: unknown): v is number {
  return typeof v === "number" && (ALLOWED_TAX_RATES as readonly number[]).includes(v);
}

function isMaxAge(v: unknown): v is number {
  return typeof v === "number" && (ALLOWED_MAX_AGES as readonly number[]).includes(v);
}

function parsePartial(raw: StoredPayload): UpgradeFilterPrefs {
  return {
    threshold: isThreshold(raw.threshold)
      ? raw.threshold
      : DEFAULT_UPGRADE_FILTER_PREFS.threshold,
    taxRate: isTaxRate(raw.taxRate)
      ? raw.taxRate
      : DEFAULT_UPGRADE_FILTER_PREFS.taxRate,
    maxAge: isMaxAge(raw.maxAge)
      ? raw.maxAge
      : DEFAULT_UPGRADE_FILTER_PREFS.maxAge,
    qualityFilter: isQualityFilter(raw.qualityFilter)
      ? raw.qualityFilter
      : DEFAULT_UPGRADE_FILTER_PREFS.qualityFilter,
    familyFilter: isFamilyFilter(raw.familyFilter)
      ? raw.familyFilter
      : DEFAULT_UPGRADE_FILTER_PREFS.familyFilter,
    pathFilter: isPathFilter(raw.pathFilter)
      ? raw.pathFilter
      : DEFAULT_UPGRADE_FILTER_PREFS.pathFilter,
    buyCity: isUpgradeBuyCityPref(raw.buyCity)
      ? raw.buyCity
      : DEFAULT_UPGRADE_FILTER_PREFS.buyCity,
  };
}

export function readStoredUpgradeFilterPrefs(): UpgradeFilterPrefs {
  if (typeof window === "undefined") return DEFAULT_UPGRADE_FILTER_PREFS;
  try {
    const raw = window.localStorage.getItem(UPGRADE_STORAGE_KEY);
    if (!raw) return DEFAULT_UPGRADE_FILTER_PREFS;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed.v !== UPGRADE_FILTER_PREFS_VERSION) {
      return DEFAULT_UPGRADE_FILTER_PREFS;
    }
    return parsePartial(parsed);
  } catch {
    return DEFAULT_UPGRADE_FILTER_PREFS;
  }
}

export function writeStoredUpgradeFilterPrefs(prefs: UpgradeFilterPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      UPGRADE_STORAGE_KEY,
      JSON.stringify({ v: UPGRADE_FILTER_PREFS_VERSION, ...prefs }),
    );
  } catch {
    /* ignore */
  }
}
