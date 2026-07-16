"use client";

import {
  REFINE_RECIPES,
  buildRefineFlips,
  calcManualRefine,
  marketFillForRecipe,
  marketIngredients,
  type DailyProductionBonus,
  type MarketSide,
  type RefineRecipe,
} from "@/lib/refineFlips";
import { formatRoi, formatSignedSilver, formatSilver } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { itemDisplayName } from "@/lib/itemNames";
import type { DumpLang } from "@/lib/i18n/types";
import type { RefineCityPreference } from "@/lib/refineFilterPrefs";
import type { AodpPriceRow } from "@/lib/types";
import { useMemo, useState } from "react";

type Props = {
  rows: AodpPriceRow[];
  taxRate: number;
  useFocus: boolean;
  dailyBonus: DailyProductionBonus;
  refineCity: RefineCityPreference;
  buySide: MarketSide;
  sellSide: MarketSide;
  /** Same age filter as the deals list — fill must match list quotes. */
  maxAge: number;
  stationFeePer100: number;
};

function recipeLabel(recipe: RefineRecipe, lang: DumpLang): string {
  // Tier/enchant already in prefix; strip " .n" from name if present.
  const name = itemDisplayName(recipe.outputId, lang).replace(/ \.[1-4]$/, "");
  const ench = recipe.enchant > 0 ? `.${recipe.enchant}` : "";
  return `T${recipe.tier}${ench} · ${name}`;
}

function parsePrice(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function RefineManualCalc({
  rows,
  taxRate,
  useFocus,
  dailyBonus,
  refineCity,
  buySide,
  sellSide,
  maxAge,
  stationFeePer100,
}: Props) {
  const { t, itemLang } = useLocale();
  const [open, setOpen] = useState(true);
  const [outputId, setOutputId] = useState("");
  const [unitPrices, setUnitPrices] = useState<Record<string, string>>({});
  const [sellPrice, setSellPrice] = useState("");
  const [fillEmpty, setFillEmpty] = useState(false);

  const recipes = useMemo(() => {
    return REFINE_RECIPES.filter((r) => marketIngredients(r) !== null).sort(
      (a, b) => {
        if (a.family !== b.family) return a.family.localeCompare(b.family);
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.enchant - b.enchant;
      },
    );
  }, []);

  const recipe = useMemo(
    () => recipes.find((r) => r.outputId === outputId) ?? null,
    [recipes, outputId],
  );

  const ingredients = recipe ? marketIngredients(recipe) : null;

  const result = useMemo(() => {
    if (!recipe || !ingredients) return null;
    const prices: Record<string, number> = {};
    for (const ing of ingredients) {
      prices[ing.itemId] = parsePrice(unitPrices[ing.itemId] ?? "");
    }
    return calcManualRefine({
      recipe,
      unitPrices: prices,
      sellPrice: parsePrice(sellPrice),
      refineCity,
      useFocus,
      dailyBonus,
      taxRate,
      stationFeePer100,
    });
  }, [
    recipe,
    ingredients,
    unitPrices,
    sellPrice,
    refineCity,
    useFocus,
    dailyBonus,
    taxRate,
    stationFeePer100,
  ]);

  function selectRecipe(id: string) {
    setOutputId(id);
    setUnitPrices({});
    setSellPrice("");
    setFillEmpty(false);
    if (id) setOpen(true);
  }

  function fillFromMarket() {
    if (!recipe || rows.length === 0) return;
    const nowMs = Date.now();
    const shared = {
      buySide,
      sellSide,
      useFocus,
      dailyBonus,
      refineCity,
      maxAgeMinutes: maxAge,
      nowMs,
      stationFeePer100,
    };

    // Prefer the exact quotes the deals list would use for this recipe.
    const listFlip = buildRefineFlips(rows, [recipe], shared)[0];
    if (listFlip) {
      const next: Record<string, string> = {};
      for (const ing of listFlip.ingredients) {
        next[ing.itemId] = String(Math.round(ing.unitPrice));
      }
      setUnitPrices(next);
      setSellPrice(String(Math.round(listFlip.revenue)));
      setFillEmpty(false);
      return;
    }

    // Incomplete market (missing one side / all stale) — fill what we can.
    const filled = marketFillForRecipe(rows, recipe, shared);
    const next: Record<string, string> = {};
    let any = false;
    for (const [id, price] of Object.entries(filled.unitPrices)) {
      if (price > 0) {
        next[id] = String(Math.round(price));
        any = true;
      }
    }
    setUnitPrices(next);
    if (filled.sellPrice !== null && filled.sellPrice > 0) {
      setSellPrice(String(Math.round(filled.sellPrice)));
      any = true;
    } else {
      setSellPrice("");
    }
    setFillEmpty(!any);
  }

  return (
    <section className="rounded-md border border-border bg-surface px-4 py-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="refine-manual-body"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left transition-colors hover:text-brass"
      >
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
            {t("refineManualTitle")}
          </p>
          {open ? (
            <p className="mt-1 text-sm text-text-dim">{t("refineManualHint")}</p>
          ) : recipe ? (
            <p className="mt-1 truncate text-sm text-text-dim">
              {recipeLabel(recipe, itemLang)}
            </p>
          ) : null}
        </div>
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 font-[family-name:var(--font-mono)] text-sm text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div id="refine-manual-body" className="mt-4">
          <div className="flex flex-wrap items-end justify-end gap-3">
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled={!recipe || rows.length === 0}
                onClick={fillFromMarket}
                className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs text-text transition-colors hover:border-brass hover:text-brass disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("refineManualFillMarket")}
              </button>
              {fillEmpty && (
                <p className="max-w-xs text-right text-[11px] text-muted">
                  {t("refineManualNoMarket")}
                </p>
              )}
            </div>
          </div>

          <label className="mt-4 flex flex-col items-start gap-1.5 text-sm">
            <span className="text-muted">{t("refineManualRecipe")}</span>
            <select
              value={outputId}
              onChange={(e) => selectRecipe(e.target.value)}
              className="max-w-full rounded-md border border-border bg-bg px-3 py-2 pr-8 font-[family-name:var(--font-mono)] text-text outline-none focus:border-brass"
            >
              <option value="">{t("refineManualPick")}</option>
              {recipes.map((r) => (
                <option key={r.outputId} value={r.outputId}>
                  {recipeLabel(r, itemLang)}
                </option>
              ))}
            </select>
          </label>

          {recipe && ingredients && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="flex flex-col gap-2">
                {ingredients.map((ing) => (
                  <label
                    key={ing.itemId}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-text">
                        {ing.count}× {itemDisplayName(ing.itemId, itemLang)}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-muted">
                        {t("refineManualUnitPrice")}
                      </span>
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={unitPrices[ing.itemId] ?? ""}
                      onChange={(e) =>
                        setUnitPrices((prev) => ({
                          ...prev,
                          [ing.itemId]: e.target.value,
                        }))
                      }
                      className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-right font-[family-name:var(--font-mono)] tabular text-text outline-none focus:border-brass"
                    />
                  </label>
                ))}
                <label className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-brass/30 bg-bg px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-text">
                      {itemDisplayName(recipe.outputId, itemLang)}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-muted">
                      {t("refineManualSellPrice")}
                    </span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-right font-[family-name:var(--font-mono)] tabular text-text outline-none focus:border-brass"
                  />
                </label>
              </div>

              {result && (
                <div className="flex flex-col justify-center gap-2 rounded-md border border-border bg-bg px-4 py-3">
                  <p className="text-[11px] text-muted">
                    {t("refineIn")} {result.refineCity} · {t("rrrAbbrev")}{" "}
                    {(result.rrr * 100).toFixed(1)}%
                    {useFocus ? ` · ${t("focusOn")}` : ""}
                    {dailyBonus > 0
                      ? ` · ${t("dailyBonusPct", { n: dailyBonus })}`
                      : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-sm tabular">
                    <span className="text-muted">{t("refineGrossCost")}</span>
                    <span className="text-right text-text">
                      {formatSilver(result.grossCost)}
                    </span>
                    <span className="text-muted">{t("refineEffectiveCost")}</span>
                    <span className="text-right text-text">
                      {formatSilver(result.effectiveCost)}
                    </span>
                    <span className="text-muted">{t("stationFee")}</span>
                    <span className="text-right text-text">
                      {formatSilver(result.stationFee)}
                    </span>
                    <span className="text-muted">{t("nutritionAbbrev")}</span>
                    <span className="text-right text-muted">
                      {result.nutrition.toFixed(2)}
                    </span>
                    <span className="text-muted">{t("netAbbrev")}</span>
                    <span className="text-right text-text-dim">
                      {formatSilver(result.net)}
                    </span>
                    <span className="text-muted">{t("craftYouGet")}</span>
                    <span
                      className={`text-right text-lg font-medium ${
                        result.complete && result.profit >= 0
                          ? "text-profit"
                          : result.complete
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {result.complete ? formatSignedSilver(result.profit) : "—"}
                    </span>
                    <span className="text-muted">{t("roiAbbrev")}</span>
                    <span className="text-right text-muted">
                      {result.complete ? formatRoi(result.roi) : "—"}
                    </span>
                  </div>
                  {!result.complete && (
                    <p className="text-[11px] text-muted">
                      {t("refineManualNeedPrices")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
