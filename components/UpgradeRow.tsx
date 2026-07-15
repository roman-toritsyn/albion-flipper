"use client";

import { CopyNameButton } from "@/components/CopyNameButton";
import { QualityBadge } from "@/components/QualityBadge";
import {
  upgradeNet,
  upgradeProfit,
  upgradeRoi,
  type UpgradeOpportunity,
} from "@/lib/upgradeFlips";
import { formatRoi, formatSignedSilver, formatSilver, itemIconUrl } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { formatAgeLabelT } from "@/lib/i18n/formatAge";
import { itemDisplayName } from "@/lib/itemNames";
import { QUALITY_COLORS, isItemQuality } from "@/lib/quality";
import { useState } from "react";

type Props = {
  flip: UpgradeOpportunity;
  taxRate: number;
  index?: number;
  now?: number;
};

export function UpgradeRow({
  flip,
  taxRate,
  index = 0,
  now = Date.now(),
}: Props) {
  const { t, itemLang } = useLocale();
  const [open, setOpen] = useState(false);
  const q = isItemQuality(flip.quality) ? flip.quality : 1;
  const qColors = QUALITY_COLORS[q];
  const displayName = itemDisplayName(flip.outputId, itemLang);
  const profit = upgradeProfit(flip.bmBuy, flip.cost, taxRate);
  const roi = upgradeRoi(flip.bmBuy, flip.cost, taxRate);
  const net = upgradeNet(flip.bmBuy, taxRate);

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
      style={{
        animationDelay: `${Math.min(index, 11) * 35}ms`,
        borderLeftWidth: 3,
        borderLeftColor: qColors.border,
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center lg:grid-cols-[minmax(200px,1.2fr)_repeat(3,minmax(120px,1fr))] lg:gap-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={itemIconUrl(flip.outputId, flip.quality)}
            alt=""
            width={88}
            height={88}
            loading="lazy"
            className="h-[88px] w-[88px] shrink-0 rounded-md bg-bg sm:h-[96px] sm:w-[96px]"
            style={{ border: `2px solid ${open ? qColors.text : qColors.border}` }}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <CopyNameButton
                text={displayName}
                title={t("copyName")}
                ariaLabel={t("copyNameAria")}
                copiedLabel={t("copied")}
              />
              <p className="min-w-0 truncate font-[family-name:var(--font-display)] text-base font-medium leading-snug text-text">
                {displayName}
              </p>
            </div>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-muted">
              T{flip.tier}.{flip.fromEnchant} → T{flip.tier}.{flip.toEnchant} ·{" "}
              {t(
                flip.family === "weapon"
                  ? "upgradeFamilyWeapon"
                  : flip.family === "armor"
                    ? "upgradeFamilyArmor"
                    : flip.family === "head"
                      ? "upgradeFamilyHead"
                      : flip.family === "shoes"
                        ? "upgradeFamilyShoes"
                        : flip.family === "offhand"
                          ? "upgradeFamilyOffhand"
                          : flip.family === "cape"
                            ? "upgradeFamilyCape"
                            : "upgradeFamilyBag",
              )}
            </p>
            <div className="mt-1.5">
              <QualityBadge quality={flip.quality} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:contents">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("upgradeCost")}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-lg tabular text-text">
              {formatSilver(flip.cost)}
            </p>
            <p className="text-[11px] text-muted">
              {flip.ingredients.length} · {t("craftIngredients").toLowerCase()}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("craftBmSell")}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-sm text-text">
              {t("blackMarket")}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-lg tabular text-text">
              {formatSilver(flip.bmBuy)}
            </p>
            <p className="text-[11px] text-muted">
              {formatAgeLabelT(flip.bmBuyDate, now, t)}
            </p>
          </div>

          <div className="lg:text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("craftYouGet")}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-sm tabular text-text-dim">
              {t("netLabel", { value: formatSilver(net) })}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-medium tabular text-profit">
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
                        {t("craftBuyIn")} {ing.city} ·{" "}
                        {formatAgeLabelT(ing.date, now, t)}
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
        </div>
      )}
    </article>
  );
}
