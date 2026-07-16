"use client";

import { LanguageSelect } from "@/components/LanguageSelect";
import { LoadErrorBanner } from "@/components/LoadErrorBanner";
import { ProfitThresholds } from "@/components/ProfitThresholds";
import { UpgradeRow } from "@/components/UpgradeRow";
import { useUpgradeFilterPrefs } from "@/hooks/useUpgradeFilterPrefs";
import type { ApiErrorBody } from "@/lib/apiErrors";
import { isFresh } from "@/lib/calc";
import { FRESH_COOLDOWN_MS } from "@/lib/constants";
import type { UpgradeFamilyFilter } from "@/lib/upgradeFilterPrefs";
import {
  UPGRADE_BUY_CITIES,
  buildUpgradeFlips,
  upgradeProfit,
  type UpgradeBuyCityPref,
  type UpgradeOpportunity,
  type UpgradePathFilter,
} from "@/lib/upgradeFlips";
import { useLocale } from "@/lib/i18n";
import type { LoadError } from "@/lib/loadError";
import { parseLoadError } from "@/lib/loadError";
import { QUALITIES, QUALITY_SHORT, type ItemQuality } from "@/lib/quality";
import {
  invalidateSiblingCityBmSessionCaches,
  readSessionApiCache,
  SESSION_API,
  writeSessionApiCache,
} from "@/lib/sessionApiCache";
import type { AodpPriceRow, UpgradeFlipsResponse } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export function UpgradeDashboard() {
  const { t } = useLocale();
  const {
    threshold,
    taxRate,
    maxAge,
    qualityFilter,
    familyFilter,
    pathFilter,
    buyCity,
    setThreshold,
    setTaxRate,
    setMaxAge,
    setQualityFilter,
    setFamilyFilter,
    setPathFilter,
    setBuyCity,
  } = useUpgradeFilterPrefs();

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
      if (!fresh) {
        const cached = readSessionApiCache<UpgradeFlipsResponse>(
          SESSION_API.upgrade,
        );
        if (cached) {
          setRows(cached.rows);
          setFetchedAt(cached.fetchedAt);
          setCacheHit(true);
          setNow(Date.now());
          return;
        }
      }

      const url = fresh ? "/api/upgrade-flips?fresh=1" : "/api/upgrade-flips";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as UpgradeFlipsResponse & ApiErrorBody;
      if (!res.ok) throw parseLoadError(res, data);

      writeSessionApiCache(SESSION_API.upgrade, data);
      if (fresh && !data.cacheHit) {
        invalidateSiblingCityBmSessionCaches(SESSION_API.upgrade);
      }

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

  const qualities =
    qualityFilter === "all" ? [1, 2, 3, 4, 5] : [qualityFilter];

  const flips: UpgradeOpportunity[] = useMemo(() => {
    return buildUpgradeFlips(rows, {
      buyCity,
      qualities,
      maxAgeMinutes: maxAge,
      nowMs: now,
    });
  }, [rows, buyCity, qualities, maxAge, now]);

  const visible = useMemo(() => {
    return flips
      .filter((f) => {
        if (familyFilter !== "all" && f.family !== familyFilter) return false;
        if (pathFilter !== "all" && f.toEnchant !== pathFilter) return false;
        if (!isFresh(f.bmBuyDate, maxAge, now)) return false;
        if (f.ingredients.some((ing) => !isFresh(ing.date, maxAge, now)))
          return false;
        const p = upgradeProfit(f.bmBuy, f.cost, taxRate);
        if (p < threshold) return false;
        return true;
      })
      .sort((a, b) => {
        const pa = upgradeProfit(a.bmBuy, a.cost, taxRate);
        const pb = upgradeProfit(b.bmBuy, b.cost, taxRate);
        if (pb !== pa) return pb - pa;
        return b.tier - a.tier;
      });
  }, [flips, familyFilter, pathFilter, maxAge, taxRate, threshold, now]);

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

  const families: Array<{ id: UpgradeFamilyFilter; label: string }> = [
    { id: "all", label: t("craftFamilyAll") },
    { id: "weapon", label: t("upgradeFamilyWeapon") },
    { id: "armor", label: t("upgradeFamilyArmor") },
    { id: "head", label: t("upgradeFamilyHead") },
    { id: "shoes", label: t("upgradeFamilyShoes") },
    { id: "offhand", label: t("upgradeFamilyOffhand") },
    { id: "cape", label: t("upgradeFamilyCape") },
    { id: "bag", label: t("upgradeFamilyBag") },
  ];

  const paths: Array<{ id: UpgradePathFilter; label: string }> = [
    { id: "all", label: t("craftFamilyAll") },
    { id: 1, label: t("upgradePathTo", { n: 1 }) },
    { id: 2, label: t("upgradePathTo", { n: 2 }) },
    { id: 3, label: t("upgradePathTo", { n: 3 }) },
  ];

  const cityChips: UpgradeBuyCityPref[] = ["auto", ...UPGRADE_BUY_CITIES];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.28em] text-brass">
            {t("serverEurope")}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-text sm:text-5xl">
            {t("brandUpgradeTitle")}
          </h1>
          <p className="mt-1 font-[family-name:var(--font-display)] text-lg text-text-dim">
            {t("upgradeSubtitle")}
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

      <div className="w-full">
        <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
          {t("upgradeBuyCity")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {cityChips.map((city) => {
            const active = city === buyCity;
            return (
              <button
                key={city}
                type="button"
                title={
                  city === "auto"
                    ? t("upgradeBuyCityAutoHint")
                    : t("upgradeBuyCityLockedHint")
                }
                onClick={() => setBuyCity(city)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-brass bg-brass text-[#1a1405]"
                    : "border-border bg-surface text-text-dim hover:text-text"
                }`}
              >
                {city === "auto" ? t("upgradeBuyCityAuto") : city}
              </button>
            );
          })}
        </div>
      </div>

      <ProfitThresholds value={threshold} onChange={setThreshold} />

      <div className="w-full">
        <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
          {t("upgradePath")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {paths.map((p) => {
            const active = p.id === pathFilter;
            return (
              <button
                key={String(p.id)}
                type="button"
                onClick={() => setPathFilter(p.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-brass bg-brass text-[#1a1405]"
                    : "border-border bg-surface text-text-dim hover:text-text"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

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
              setQualityFilter(
                v === "all" ? "all" : (Number(v) as ItemQuality),
              );
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

      {error && <LoadErrorBanner error={error} onRetry={() => void load(true)} />}

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

        {!showLoader && !error && visible.length === 0 && (
          <p className="py-16 text-center text-muted">
            {t("upgradeNoDeals", { age: ageDisplay })}
          </p>
        )}

        {!showLoader &&
          visible.map((flip, i) => (
            <UpgradeRow
              key={`${flip.outputId}-${flip.quality}-${flip.fromEnchant}-${flip.toEnchant}-${i}`}
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
