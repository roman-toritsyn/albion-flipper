"use client";

import { LanguageSelect } from "@/components/LanguageSelect";
import { LoadErrorBanner } from "@/components/LoadErrorBanner";
import { RefineManualCalc } from "@/components/RefineManualCalc";
import { RefineRow } from "@/components/RefineRow";
import { useRefineFilterPrefs } from "@/hooks/useRefineFilterPrefs";
import type { ApiErrorBody } from "@/lib/apiErrors";
import { isFresh } from "@/lib/calc";
import { FRESH_COOLDOWN_MS } from "@/lib/constants";
import type { RefineFamilyFilter } from "@/lib/refineFilterPrefs";
import {
  buildRefineFlips,
  refineProfit,
  type DailyProductionBonus,
  type MarketSide,
  type RefineOpportunity,
} from "@/lib/refineFlips";
import { useLocale } from "@/lib/i18n";
import type { LoadError } from "@/lib/loadError";
import { parseLoadError } from "@/lib/loadError";
import type { AodpPriceRow, RefineFlipsResponse } from "@/lib/types";
import { REFINE_CITIES } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export function RefineDashboard() {
  const { t } = useLocale();
  const {
    taxRate,
    maxAge,
    familyFilter,
    buySide,
    sellSide,
    useFocus,
    dailyBonus,
    refineCity,
    stationFeePer100,
    setTaxRate,
    setMaxAge,
    setFamilyFilter,
    setBuySide,
    setSellSide,
    setUseFocus,
    setDailyBonus,
    setRefineCity,
    setStationFeePer100,
  } = useRefineFilterPrefs();

  const [rows, setRows] = useState<AodpPriceRow[]>([]);
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
      const url = fresh ? "/api/refine-flips?fresh=1" : "/api/refine-flips";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as RefineFlipsResponse & ApiErrorBody;
      if (!res.ok) throw parseLoadError(res, data);
      setRows(data.rows);
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
    const id = setInterval(() => setCooldownLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const flips: RefineOpportunity[] = useMemo(() => {
    return buildRefineFlips(rows, undefined, {
      buySide,
      sellSide,
      useFocus,
      dailyBonus,
      refineCity,
      maxAgeMinutes: maxAge,
      nowMs: now,
      stationFeePer100,
    });
  }, [
    rows,
    buySide,
    sellSide,
    useFocus,
    dailyBonus,
    refineCity,
    maxAge,
    now,
    stationFeePer100,
  ]);

  const visible = useMemo(() => {
    return flips
      .filter((f) => {
        if (familyFilter !== "all" && f.family !== familyFilter) return false;
        if (!isFresh(f.revenueDate, maxAge, now)) return false;
        if (f.ingredients.some((ing) => !isFresh(ing.date, maxAge, now))) return false;
        // Hide dead routes — refine list is for opportunities, not dump-loss noise.
        const p = refineProfit(f.revenue, f.effectiveCost, taxRate, f.stationFee);
        if (p < 0) return false;
        return true;
      })
      .sort((a, b) => {
        const pa = refineProfit(a.revenue, a.effectiveCost, taxRate, a.stationFee);
        const pb = refineProfit(b.revenue, b.effectiveCost, taxRate, b.stationFee);
        if (pb !== pa) return pb - pa;
        return b.tier - a.tier;
      });
  }, [flips, familyFilter, maxAge, taxRate, now]);

  const showLoader = loading || refreshing;
  const refreshDisabled = refreshing || cooldownLeft > 0;

  function formatCacheAge(fetched: number | null, current: number): string {
    if (!fetched) return t("cacheNotLoaded");
    const sec = Math.max(0, Math.floor((current - fetched) / 1000));
    if (sec < 60) return t("cacheSecAgo", { n: sec });
    return t("cacheMinAgo", { n: Math.floor(sec / 60) });
  }

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
                : t("ageHours", { n: maxAge / 60 });

  const families: { id: RefineFamilyFilter; label: string }[] = [
    { id: "all", label: t("craftFamilyAll") },
    { id: "bars", label: t("refineFamilyBars") },
    { id: "planks", label: t("refineFamilyPlanks") },
    { id: "cloth", label: t("refineFamilyCloth") },
    { id: "leather", label: t("refineFamilyLeather") },
    { id: "stone", label: t("refineFamilyStone") },
  ];

  const sides: { id: MarketSide; label: string }[] = [
    { id: "instant", label: t("marketInstant") },
    { id: "order", label: t("marketOrder") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.28em] text-brass">
            {t("serverEurope")}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-text sm:text-5xl">
            {t("brandRefineTitle")}
          </h1>
          <p className="mt-1 font-[family-name:var(--font-display)] text-lg text-text-dim">
            {t("refineSubtitle")}
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
              : `${t("serverEurope")} · ${formatCacheAge(fetchedAt, now)} · ${
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
            {t("refineBuySide")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sides.map((s) => (
              <button
                key={`buy-${s.id}`}
                type="button"
                onClick={() => setBuySide(s.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  buySide === s.id
                    ? "border-brass bg-brass text-[#1a1405]"
                    : "border-border bg-surface text-text-dim hover:text-text"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
            {t("refineSellSide")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sides.map((s) => (
              <button
                key={`sell-${s.id}`}
                type="button"
                onClick={() => setSellSide(s.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  sellSide === s.id
                    ? "border-brass bg-brass text-[#1a1405]"
                    : "border-border bg-surface text-text-dim hover:text-text"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={useFocus}
            onChange={(e) => setUseFocus(e.target.checked)}
            className="accent-[var(--brass,#c4a35a)]"
          />
          <span>{t("focusOn")}</span>
        </label>
        <div>
          <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
            {t("dailyBonus")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {([0, 10, 20] as DailyProductionBonus[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDailyBonus(n)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  dailyBonus === n
                    ? "border-brass bg-brass text-[#1a1405]"
                    : "border-border bg-surface text-text-dim hover:text-text"
                }`}
              >
                {n === 0 ? t("dailyBonusOff") : t("dailyBonusPct", { n })}
              </button>
            ))}
          </div>
        </div>
      <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span className="text-muted">{t("refineCity")}</span>
          <select
            value={refineCity}
            onChange={(e) =>
              setRefineCity(
                e.target.value === "auto"
                  ? "auto"
                  : (e.target.value as (typeof REFINE_CITIES)[number]),
              )
            }
            className="max-w-[14rem] bg-transparent font-[family-name:var(--font-mono)] text-text outline-none"
          >
            <option value="auto">{t("refineCityAuto")}</option>
            {REFINE_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
          {t("craftFamily")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {families.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFamilyFilter(f.id)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                familyFilter === f.id
                  ? "border-brass bg-brass text-[#1a1405]"
                  : "border-border bg-surface text-text-dim hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <section className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-muted">{t("tax")}</span>
          <select
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            className="bg-transparent font-[family-name:var(--font-mono)] text-text outline-none"
          >
            <option value={0.04}>{t("taxPremium")}</option>
            <option value={0.08}>{t("taxFull")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-muted" title={t("stationFeeHint")}>
            {t("stationFeePer100")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={stationFeePer100 === 0 ? "" : String(stationFeePer100)}
            placeholder="0"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setStationFeePer100(digits === "" ? 0 : Number(digits));
            }}
            className="w-24 bg-transparent font-[family-name:var(--font-mono)] tabular text-text outline-none placeholder:text-muted"
          />
        </label>
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-muted">{t("dataAge")}</span>
          <select
            value={maxAge}
            onChange={(e) => setMaxAge(Number(e.target.value))}
            className="bg-transparent font-[family-name:var(--font-mono)] text-text outline-none"
          >
            <option value={60}>{t("age1h")}</option>
            <option value={180}>{t("age3h")}</option>
            <option value={360}>{t("age6h")}</option>
            <option value={720}>{t("age12h")}</option>
            <option value={1440}>{t("age24h")}</option>
            <option value={2880}>{t("age48h")}</option>
          </select>
        </label>
      </section>

      <RefineManualCalc
        rows={rows}
        taxRate={taxRate}
        useFocus={useFocus}
        dailyBonus={dailyBonus}
        refineCity={refineCity}
        buySide={buySide}
        sellSide={sellSide}
        maxAge={maxAge}
        stationFeePer100={stationFeePer100}
      />

      <section className="flex flex-col gap-2">
        <p className="font-[family-name:var(--font-mono)] text-xs text-muted">
          {showLoader
            ? refreshing
              ? t("updatingData")
              : t("loading")
            : `${t("dealsCount", { n: visible.length })} · ${t("sortByProfit")}`}
        </p>

        {showLoader && (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[88px] rounded-md border border-border" />
            ))}
          </div>
        )}

        {!showLoader && error && (
          <LoadErrorBanner error={error} onRetry={() => void load(true)} />
        )}

        {!showLoader && !error && visible.length === 0 && (
          <p className="py-16 text-center text-muted">
            {t("refineNoDeals", { age: ageDisplay })}
          </p>
        )}

        {!showLoader &&
          !error &&
          visible.map((flip, i) => (
            <RefineRow
              key={`${flip.outputId}-${flip.refineCity}-${flip.buySide}-${flip.sellSide}-${flip.effectiveCost}-${flip.stationFee}`}
              flip={flip}
              taxRate={taxRate}
              index={i}
              now={now}
            />
          ))}
      </section>
    </div>
  );
}
