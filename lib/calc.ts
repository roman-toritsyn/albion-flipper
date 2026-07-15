import type { CityLocation, FlipKind } from "./types";

/**
 * AODP returns timestamps like `2026-07-14T20:15:00` in UTC **without** `Z`.
 * `Date.parse` would treat that as local time and inflate age by the TZ offset
 * (e.g. +3h in Ukraine). Normalize to UTC before comparing.
 */
export function parseAodpDate(dateIso: string): number {
  if (!dateIso || dateIso.startsWith("0001")) return Number.NaN;
  const normalized =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateIso) ? dateIso : `${dateIso}Z`;
  return Date.parse(normalized);
}

export function ageMinutes(dateIso: string, nowMs: number = Date.now()): number {
  const t = parseAodpDate(dateIso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - t) / 60_000);
}

export function netAfterTax(bmBuy: number, taxRate: number): number {
  return bmBuy * (1 - taxRate);
}

export function profit(bmBuy: number, citySell: number, taxRate: number): number {
  return netAfterTax(bmBuy, taxRate) - citySell;
}

export function roi(bmBuy: number, citySell: number, taxRate: number): number {
  if (citySell <= 0) return 0;
  return profit(bmBuy, citySell, taxRate) / citySell;
}

export function isFresh(dateIso: string, maxAgeMinutes: number, nowMs?: number): boolean {
  return ageMinutes(dateIso, nowMs) <= maxAgeMinutes;
}

export function flipKind(city: CityLocation): FlipKind {
  return city === "Caerleon" ? "local" : "remote";
}

export function formatAgeLabel(dateIso: string, nowMs: number = Date.now()): string {
  const mins = ageMinutes(dateIso, nowMs);
  if (!Number.isFinite(mins)) return "немає даних";
  if (mins < 1) return "<1 хв";
  if (mins < 60) return `${Math.floor(mins)} хв`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.floor(hours)} год`;
  return `${Math.floor(hours / 24)} д`;
}

/** City quote much older than BM — buy side likely more risky. */
export function isCityStalerThanBm(
  citySellDate: string,
  bmBuyDate: string,
  nowMs: number = Date.now(),
  gapMinutes = 120,
): boolean {
  return ageMinutes(citySellDate, nowMs) - ageMinutes(bmBuyDate, nowMs) >= gapMinutes;
}
