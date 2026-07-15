"use client";

import { CraftRow } from "@/components/CraftRow";
import { LanguageSelect } from "@/components/LanguageSelect";
import { ProfitThresholds } from "@/components/ProfitThresholds";
import { useCraftFilterPrefs } from "@/hooks/useCraftFilterPrefs";
import { isFresh } from "@/lib/calc";
import { FRESH_COOLDOWN_MS } from "@/lib/constants";
import type { CraftFamilyFilter } from "@/lib/craftFilterPrefs";
import {
  CRAFT_BUY_MODES,
  craftProfit,
  type CraftBuyMode,
  type CraftFlipOpportunity,
  type CraftFlipsByMode,
} from "@/lib/craftFlips";
import { useLocale } from "@/lib/i18n";
import { QUALITIES, QUALITY_SHORT, type ItemQuality } from "@/lib/quality";
import type { CraftFlipsResponse } from "@/lib/types";
import { CITY_LOCATIONS } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const EMPTY_BY_MODE = Object.fromEntries(
  CRAFT_BUY_MODES.map((m) => [m, [] as CraftFlipOpportunity[]]),
) as CraftFlipsByMode;

function buyModeLabel(
  mode: CraftBuyMode,
  t: (key: "craftBuyRoyal") => string,
): string {
  if (mode === "royal") return t("craftBuyRoyal");
  return mode;
}

export function CraftDashboard() {
  const { t, htmlLang } = useLocale();
  const {
    threshold,
    taxRate,
    maxAge,
    qualityFilter,
    familyFilter,
    buyMode,
    setThreshold,
    setTaxRate,
    setMaxAge,
    setQualityFilter,
    setFamilyFilter,
    setBuyMode,
  } = useCraftFilterPrefs();

  const [flipsByMode, setFlipsByMode] = useState<CraftFlipsByMode>(EMPTY_BY_MODE);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (fresh: boolean) => {
    if (fresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const url = fresh ? "/api/craft-flips?fresh=1" : "/api/craft-flips";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as CraftFlipsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setFlipsByMode(data.flipsByMode);
      setFetchedAt(data.fetchedAt);
      setCacheHit(data.cacheHit);
      setNow(Date.now());
      if (fresh && !data.cacheHit) {
        setCooldownLeft(Math.ceil(FRESH_COOLDOWN_MS / 1000));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "load error");
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

  const raw = flipsByMode[buyMode] ?? [];

  const visible = useMemo(() => {
    return raw
      .filter((f) => {
        if (familyFilter !== "all" && f.family !== familyFilter) return false;
        if (qualityFilter !== "all" && f.quality !== qualityFilter) return false;
        if (!isFresh(f.bmBuyDate, maxAge, now)) return false;
        if (f.ingredients.some((ing) => !isFresh(ing.date, maxAge, now))) return false;
        const p = craftProfit(f.bmBuy, f.cost, taxRate);
        return p >= threshold;
      })
      .sort((a, b) => {
        const pa = craftProfit(a.bmBuy, a.cost, taxRate);
        const pb = craftProfit(b.bmBuy, b.cost, taxRate);
        if (pb !== pa) return pb - pa;
        return b.quality - a.quality;
      });
  }, [raw, familyFilter, qualityFilter, maxAge, taxRate, threshold, now]);

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

  const buyChips: CraftBuyMode[] = ["royal", ...CITY_LOCATIONS];

  const families: { id: CraftFamilyFilter; label: string }[] = [
    { id: "all", label: t("craftFamilyAll") },
    { id: "cape", label: t("craftFamilyCapes") },
    { id: "royal", label: t("craftFamilyRoyal") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.28em] text-brass">
            Europe
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-text sm:text-5xl">
            CRAFT
          </h1>
          <p className="mt-1 font-[family-name:var(--font-display)] text-lg text-text-dim">
            → BLACK MARKET
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

      <div className="w-full">
        <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
          {t("craftBuyMode")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {buyChips.map((mode) => {
            const active = mode === buyMode;
            return (
              <button
                key={mode}
                type="button"
                title={
                  mode === "royal" ? t("craftBuyRoyalHint") : t("craftBuyCityHint")
                }
                onClick={() => setBuyMode(mode)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-brass bg-brass text-[#1a1405]"
                    : "border-border bg-surface text-text-dim hover:text-text"
                }`}
              >
                {buyModeLabel(mode, t)}
              </button>
            );
          })}
        </div>
      </div>

      <ProfitThresholds value={threshold} onChange={setThreshold} />

      <div className="w-full">
        <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
          {t("craftFamily")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {families.map((f) => {
            const active = f.id === familyFilter;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFamilyFilter(f.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-brass bg-brass text-[#1a1405]"
                    : "border-border bg-surface text-text-dim hover:text-text"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-muted">{t("quality")}</span>
          <select
            value={qualityFilter === "all" ? "all" : String(qualityFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setQualityFilter(v === "all" ? "all" : (Number(v) as ItemQuality));
            }}
            className="bg-transparent font-[family-name:var(--font-mono)] text-text outline-none"
          >
            <option value="all">{t("allQualities")}</option>
            {QUALITIES.map((q) => (
              <option key={q} value={q}>
                {QUALITY_SHORT[q]}
              </option>
            ))}
          </select>
        </label>
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
          <p className="py-16 text-center text-danger">{t("loadFailed", { error })}</p>
        )}

        {!showLoader && !error && visible.length === 0 && (
          <p className="py-16 text-center text-muted">
            {t("craftNoDeals", {
              threshold: threshold.toLocaleString(htmlLang),
              age: ageDisplay,
            })}
          </p>
        )}

        {!showLoader &&
          !error &&
          visible.map((flip, i) => (
            <CraftRow
              key={`${String(flip.buyMode)}-${flip.outputId}-q${flip.quality}-${flip.cost}-${flip.bmBuy}`}
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
