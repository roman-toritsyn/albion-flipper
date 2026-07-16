"use client";

import { CopyNameButton } from "@/components/CopyNameButton";
import {
  refineNet,
  refineProfit,
  refineRoi,
  type RefineOpportunity,
} from "@/lib/refineFlips";
import { formatRoi, formatSignedSilver, formatSilver, itemIconUrl } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { formatAgeLabelT } from "@/lib/i18n/formatAge";
import { itemDisplayName } from "@/lib/itemNames";
import { formatWeightNumber, itemWeightKg } from "@/lib/itemWeights";
import { useState } from "react";

type Props = {
  flip: RefineOpportunity;
  taxRate: number;
  index?: number;
  now?: number;
};

export function RefineRow({ flip, taxRate, index = 0, now = Date.now() }: Props) {
  const { t, itemLang } = useLocale();
  const [open, setOpen] = useState(false);
  const displayName = itemDisplayName(flip.outputId, itemLang);
  const profit = refineProfit(flip.revenue, flip.effectiveCost, taxRate, flip.stationFee);
  const roi = refineRoi(flip.revenue, flip.effectiveCost, taxRate, flip.stationFee);
  const net = refineNet(flip.revenue, taxRate);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      className="fade-up cursor-pointer border border-border bg-surface px-3 py-3 transition-colors hover:bg-surface-hover"
      style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
    >
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center lg:grid-cols-[minmax(200px,1.2fr)_repeat(3,minmax(120px,1fr))] lg:gap-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={itemIconUrl(flip.outputId, 1)}
            alt=""
            width={88}
            height={88}
            loading="lazy"
            className="h-[88px] w-[88px] shrink-0 rounded-md border border-border bg-bg sm:h-[96px] sm:w-[96px]"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <CopyNameButton
                text={displayName}
                title={t("copyName")}
                ariaLabel={t("copyNameAria")}
                copiedLabel={t("copied")}
              />
              <p className="min-w-0 truncate font-[family-name:var(--font-display)] text-base font-medium text-text">
                {displayName}
              </p>
            </div>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-muted">
              T{flip.tier}
              {flip.enchant > 0 ? `.${flip.enchant}` : ""} ·{" "}
              {flip.family === "bars"
                ? t("refineFamilyBars")
                : flip.family === "planks"
                  ? t("refineFamilyPlanks")
                  : flip.family === "cloth"
                    ? t("refineFamilyCloth")
                    : flip.family === "leather"
                      ? t("refineFamilyLeather")
                      : t("refineFamilyStone")}
            </p>
            <p className="mt-1 text-[11px] text-text-dim">
              {t("refineIn")} {flip.refineCity} · {t("rrrAbbrev")}{" "}
              {(flip.rrr * 100).toFixed(1)}%
              {flip.useFocus ? ` · ${t("focusOn")}` : ""}
              {flip.dailyBonus > 0
                ? ` · ${t("dailyBonusPct", { n: flip.dailyBonus })}`
                : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:contents">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("refineEffectiveCost")}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-lg tabular text-text">
              {formatSilver(flip.effectiveCost)}
            </p>
            <p className="text-[11px] text-muted">
              {t("refineGrossCost")} {formatSilver(flip.grossCost)}
              {flip.stationFee > 0
                ? ` · ${t("stationFee")} ${formatSilver(flip.stationFee)}`
                : ""}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("refineSell")}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-sm text-text">
              {flip.revenueCity}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-lg tabular text-text">
              {formatSilver(flip.revenue)}
            </p>
            <p className="text-[11px] text-muted">
              {formatAgeLabelT(flip.revenueDate, now, t)}
            </p>
          </div>

          <div className="lg:text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("craftYouGet")}</p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-sm tabular text-text-dim">
              {t("netLabel", { value: formatSilver(net) })}
            </p>
            <p
              className={`font-[family-name:var(--font-mono)] text-2xl font-medium tabular ${
                profit >= 0 ? "text-profit" : "text-danger"
              }`}
            >
              {formatSignedSilver(profit)}
            </p>
            <p className="text-[11px] text-muted">
              {t("roiLabel", { value: formatRoi(roi) })}
            </p>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="mt-3 overflow-hidden rounded-md border border-border bg-bg-mid"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-border px-3 py-2">
            <p className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("craftIngredients")}
            </p>
          </div>
          <ul className="py-1">
            {flip.ingredients.map((ing) => {
              const name = itemDisplayName(ing.itemId, itemLang);
              const unitKg = itemWeightKg(ing.itemId);
              return (
                <li
                  key={`${ing.itemId}-${ing.city}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 items-start gap-1.5">
                    <CopyNameButton
                      text={name}
                      title={t("copyName")}
                      ariaLabel={t("copyNameAria")}
                      copiedLabel={t("copied")}
                      className="mt-0.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-brass hover:text-brass"
                      iconSize={12}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text">
                        {ing.count}× {name}
                      </span>
                      <span className="text-[11px] text-muted">
                        {t("craftBuyIn")} {ing.city} · {formatAgeLabelT(ing.date, now, t)}
                        {unitKg !== null
                          ? ` · ${t("weightEach", { n: formatWeightNumber(unitKg) })}`
                          : ""}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs tabular">
                    {formatSilver(ing.lineTotal)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-3 py-2 text-[11px] text-muted">
            {t("refineRoute")}:{" "}
            {t("refineRouteDetail", {
              refine: flip.refineCity,
              sell: flip.revenueCity,
            })}
            {flip.nutrition > 0 || flip.stationFee > 0
              ? ` · ${t("nutritionLabel", { n: flip.nutrition.toFixed(2) })} · ${t("stationFee")} ${formatSilver(flip.stationFee)}`
              : ""}
          </div>
        </div>
      )}
    </article>
  );
}
