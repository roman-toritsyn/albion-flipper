"use client";

import { FlipRow, type FlipRowView } from "@/components/FlipRow";
import type { CityPriceQuote } from "@/components/CityPricesDropdown";
import { LanguageSelect } from "@/components/LanguageSelect";
import { ProfitThresholds } from "@/components/ProfitThresholds";
import { SecondaryFilters, type CityFilter } from "@/components/SecondaryFilters";
import { SortTabs } from "@/components/SortTabs";
import { useFilterPrefs } from "@/hooks/useFilterPrefs";
import { ageMinutes, isFresh, netAfterTax, profit, roi } from "@/lib/calc";
import { FRESH_COOLDOWN_MS } from "@/lib/constants";
import { useLocale } from "@/lib/i18n";
import type { LoadError } from "@/lib/loadError";
import { parseLoadError } from "@/lib/loadError";
import { qualityKey } from "@/lib/quality";
import { ROYAL_CITIES, type FlipOpportunity, type FlipsResponse } from "@/lib/types";
import type { ApiErrorBody } from "@/lib/apiErrors";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadErrorBanner } from "@/components/LoadErrorBanner";

function flipAgeMinutes(flip: FlipRowView, now: number): number {
  return Math.max(
    ageMinutes(flip.citySellDate, now),
    ageMinutes(flip.bmBuyDate, now),
  );
}

const ROYAL_SET = new Set<string>(ROYAL_CITIES);

function toView(
  flip: FlipOpportunity,
  taxRate: number,
  maxAge: number,
  now: number,
): FlipRowView | null {
  if (!isFresh(flip.citySellDate, maxAge, now)) return null;
  if (!isFresh(flip.bmBuyDate, maxAge, now)) return null;

  const p = profit(flip.bmBuy, flip.citySell, taxRate);
  if (p <= 0) return null;

  return {
    itemId: flip.itemId,
    quality: flip.quality ?? 1,
    city: flip.city,
    citySell: flip.citySell,
    citySellDate: flip.citySellDate,
    bmBuy: flip.bmBuy,
    bmBuyDate: flip.bmBuyDate,
    kind: flip.kind,
    netAfterTax: netAfterTax(flip.bmBuy, taxRate),
    profit: p,
    roi: roi(flip.bmBuy, flip.citySell, taxRate),
    cityAgeStale: ageMinutes(flip.citySellDate, now) > maxAge * 0.7,
    bmAgeStale: ageMinutes(flip.bmBuyDate, now) > maxAge * 0.7,
  };
}

function passesCityFilter(city: string, filter: CityFilter): boolean {
  if (filter === "all") return true;
  if (filter === "royal") return ROYAL_SET.has(city);
  return city === filter;
}

export function Dashboard() {
  const { t, htmlLang } = useLocale();
  const {
    threshold,
    taxRate,
    maxAge,
    cityFilter,
    qualityFilter,
    sortTab,
    setThreshold,
    setTaxRate,
    setMaxAge,
    setCityFilter,
    setQualityFilter,
    setSortTab,
  } = useFilterPrefs();
  const [raw, setRaw] = useState<FlipOpportunity[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<LoadError | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (fresh: boolean) => {
    if (fresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url = fresh ? "/api/flips?fresh=1" : "/api/flips";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as FlipsResponse & ApiErrorBody;
      if (!res.ok) throw parseLoadError(res, data);

      setRaw(data.flips);
      setFetchedAt(data.fetchedAt);
      setCacheHit(data.cacheHit);
      setNow(Date.now());
      if (fresh && !data.cacheHit) {
        setCooldownLeft(Math.ceil(FRESH_COOLDOWN_MS / 1000));
      }
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && "message" in e) {
        setError(e as LoadError);
      } else {
        setError({
          code: "UNKNOWN",
          message: e instanceof Error ? e.message : "load error",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(() => {
    const rows = raw
      .map((f) => toView(f, taxRate, maxAge, now))
      .filter((f): f is FlipRowView => f !== null)
      .filter((f) => f.profit >= threshold)
      .filter((f) => passesCityFilter(f.city, cityFilter))
      .filter((f) => (qualityFilter === "all" ? true : f.quality === qualityFilter));

    if (sortTab === "fresh") {
      return rows.sort((a, b) => {
        const ageDiff = flipAgeMinutes(a, now) - flipAgeMinutes(b, now);
        if (ageDiff !== 0) return ageDiff;
        if (b.quality !== a.quality) return b.quality - a.quality;
        return b.profit - a.profit;
      });
    }

    return rows.sort((a, b) => {
      if (b.profit !== a.profit) return b.profit - a.profit;
      return b.quality - a.quality;
    });
  }, [raw, taxRate, maxAge, threshold, cityFilter, qualityFilter, sortTab, now]);

  const hintCounts = useMemo(() => {
    const countForAge = (age: number) =>
      raw
        .map((f) => toView(f, taxRate, age, now))
        .filter((f): f is FlipRowView => f !== null)
        .filter((f) => f.profit >= threshold)
        .filter((f) => passesCityFilter(f.city, cityFilter))
        .filter((f) => (qualityFilter === "all" ? true : f.quality === qualityFilter)).length;

    return {
      h24: countForAge(24 * 60),
      h48: countForAge(48 * 60),
      anyProfit: raw.filter((f) => {
        const p = profit(f.bmBuy, f.citySell, taxRate);
        return (
          p >= threshold &&
          passesCityFilter(f.city, cityFilter) &&
          (qualityFilter === "all" || f.quality === qualityFilter)
        );
      }).length,
    };
  }, [raw, taxRate, threshold, cityFilter, qualityFilter, now]);

  const quotesByItemQuality = useMemo(() => {
    const map = new Map<string, CityPriceQuote[]>();

    for (const f of raw) {
      const key = qualityKey(f.itemId, f.quality ?? 1);
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }

      if (f.bmBuy > 0 && !list.some((q) => q.kind === "bm")) {
        list.push({
          city: "Black Market",
          price: f.bmBuy,
          date: f.bmBuyDate,
          kind: "bm",
        });
      }

      if (f.citySell > 0 && !list.some((q) => q.kind === "city" && q.city === f.city)) {
        list.push({
          city: f.city,
          price: f.citySell,
          date: f.citySellDate,
          kind: "city",
        });
      }
    }

    return map;
  }, [raw]);

  const refreshDisabled = refreshing || cooldownLeft > 0;
  const showLoader = loading || refreshing;

  function formatCacheAge(fetched: number | null, current: number): string {
    if (!fetched) return t("cacheNotLoaded");
    const sec = Math.max(0, Math.floor((current - fetched) / 1000));
    if (sec < 60) return t("cacheSecAgo", { n: sec });
    return t("cacheMinAgo", { n: Math.floor(sec / 60) });
  }

  const ageLabel =
    maxAge >= 60 ? t("ageHours", { n: maxAge / 60 }).replace(/\s/g, " ") : t("ageMinutes", { n: maxAge });

  // Prefer locale-specific hour labels from filter options when possible
  const ageDisplay =
    maxAge === 60
      ? t("age1h")
      : maxAge === 180
        ? t("age3h")
        : maxAge === 360
          ? t("age6h")
          : maxAge === 720
            ? t("age12h")
            : maxAge === 1440
              ? t("age24h")
              : maxAge === 2880
                ? t("age48h")
                : ageLabel;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.28em] text-brass">
            Europe
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-text sm:text-5xl">
            FLIP
          </h1>
          <p className="mt-1 font-[family-name:var(--font-display)] text-lg text-text-dim">
            BLACK MARKET
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <LanguageSelect />
          <p
            className={`font-[family-name:var(--font-mono)] text-xs text-muted ${
              refreshing ? "animate-pulse" : ""
            }`}
          >
            {refreshing
              ? t("refreshingDots")
              : `Europe · ${formatCacheAge(fetchedAt, now)} · ${
                  cacheHit === null ? "…" : cacheHit ? t("cacheHit") : t("freshData")
                }`}
          </p>
          <button
            type="button"
            disabled={refreshDisabled}
            onClick={() => void load(true)}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text transition-colors hover:border-brass hover:text-brass disabled:cursor-not-allowed disabled:opacity-40"
          >
            {refreshing
              ? t("refreshing")
              : cooldownLeft > 0
                ? t("refreshCooldown", { n: cooldownLeft })
                : t("refresh")}
          </button>
        </div>
      </header>

      <SortTabs value={sortTab} onChange={setSortTab} />
      <ProfitThresholds value={threshold} onChange={setThreshold} />
      <SecondaryFilters
        taxRate={taxRate}
        maxAge={maxAge}
        city={cityFilter}
        quality={qualityFilter}
        onTaxRate={setTaxRate}
        onMaxAge={setMaxAge}
        onCity={setCityFilter}
        onQuality={setQualityFilter}
      />

      <section className="flex flex-col gap-2">
        <p className="font-[family-name:var(--font-mono)] text-xs text-muted">
          {showLoader
            ? refreshing
              ? t("updatingData")
              : t("loading")
            : `${t("dealsCount", { n: visible.length })} · ${
                sortTab === "profit" ? t("sortByProfit") : t("sortByFresh")
              }`}
        </p>

        {showLoader && (
          <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[88px] rounded-md border border-border" />
            ))}
          </div>
        )}

        {!showLoader && error && (
          <LoadErrorBanner error={error} onRetry={() => void load(true)} />
        )}

        {!showLoader && !error && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-muted">
              {t("noDeals", {
                threshold: threshold.toLocaleString(htmlLang),
                age: ageDisplay,
              })}
            </p>
            <p className="max-w-md font-[family-name:var(--font-mono)] text-xs text-text-dim">
              {t("aodpHint", {
                h24: hintCounts.h24,
                h48: hintCounts.h48,
                any: hintCounts.anyProfit,
              })}
            </p>
            {hintCounts.h24 > 0 && maxAge < 24 * 60 && (
              <button
                type="button"
                onClick={() => setMaxAge(24 * 60)}
                className="rounded-md border border-brass/50 px-3 py-1.5 text-sm text-brass hover:bg-brass/10"
              >
                {t("showAge24h")}
              </button>
            )}
          </div>
        )}

        {!showLoader &&
          !error &&
          visible.map((flip, i) => (
            <FlipRow
              key={`${flip.itemId}-q${flip.quality}-${flip.city}-${flip.citySell}`}
              flip={flip}
              index={i}
              now={now}
              cityQuotes={
                quotesByItemQuality.get(qualityKey(flip.itemId, flip.quality)) ?? []
              }
            />
          ))}
      </section>
    </div>
  );
}
