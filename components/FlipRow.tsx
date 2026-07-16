"use client";

import { CityPricesDropdown, type CityPriceQuote } from "@/components/CityPricesDropdown";
import { QualityBadge } from "@/components/QualityBadge";
import { isCityStalerThanBm } from "@/lib/calc";
import {
  formatItemTierEnchant,
  formatRoi,
  formatSignedSilver,
  formatSilver,
  itemIconUrl,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { formatAgeLabelT } from "@/lib/i18n/formatAge";
import { itemDisplayName } from "@/lib/itemNames";
import { QUALITY_COLORS, isItemQuality } from "@/lib/quality";
import type { FlipKind } from "@/lib/types";
import { useState } from "react";

export type FlipRowView = {
  itemId: string;
  quality: number;
  city: string;
  citySell: number;
  citySellDate: string;
  bmBuy: number;
  bmBuyDate: string;
  kind: FlipKind;
  netAfterTax: number;
  profit: number;
  roi: number;
  cityAgeStale?: boolean;
  bmAgeStale?: boolean;
};

type Props = {
  flip: FlipRowView;
  index?: number;
  now?: number;
  cityQuotes?: CityPriceQuote[];
};

function Age({
  date,
  stale,
  now,
}: {
  date: string;
  stale?: boolean;
  now: number;
}) {
  const { t } = useLocale();
  return (
    <span className={`text-[11px] ${stale ? "text-stale" : "text-muted"}`}>
      {formatAgeLabelT(date, now, t)}
    </span>
  );
}

export function FlipRow({ flip, index = 0, now = Date.now(), cityQuotes = [] }: Props) {
  const { t, itemLang } = useLocale();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cityRisk = isCityStalerThanBm(flip.citySellDate, flip.bmBuyDate, now);
  const q = isItemQuality(flip.quality) ? flip.quality : 1;
  const qColors = QUALITY_COLORS[q];
  const displayName = itemDisplayName(flip.itemId, itemLang);
  const tierEnchant = formatItemTierEnchant(flip.itemId);

  async function copyName(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayName);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = displayName;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

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
            src={itemIconUrl(flip.itemId, flip.quality)}
            alt=""
            width={88}
            height={88}
            loading="lazy"
            className="h-[88px] w-[88px] shrink-0 rounded-md bg-bg sm:h-[96px] sm:w-[96px]"
            style={{ border: `2px solid ${open ? qColors.text : qColors.border}` }}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="relative shrink-0">
                <button
                  type="button"
                  onClick={copyName}
                  onPointerDown={(e) => e.stopPropagation()}
                  title={t("copyName")}
                  aria-label={t("copyNameAria")}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-brass hover:text-brass"
                >
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <rect
                        x="9"
                        y="9"
                        width="11"
                        height="11"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M5 15V5a2 2 0 0 1 2-2h10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
                {copied && (
                  <p className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 whitespace-nowrap text-[10px] leading-none text-profit">
                    {t("copied")}
                  </p>
                )}
              </span>
              <p className="min-w-0 truncate font-[family-name:var(--font-display)] text-base font-medium leading-snug text-text">
                {displayName}
              </p>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <div className="flex flex-col items-start gap-1.5">
                <QualityBadge quality={flip.quality} />
                {tierEnchant && (
                  <span className="font-[family-name:var(--font-mono)] text-sm font-medium tabular leading-tight text-text">
                    {tierEnchant}
                  </span>
                )}
              </div>
              <span
                className={`inline-block self-start rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                  flip.kind === "local"
                    ? "border-brass/40 text-brass"
                    : "border-remote/40 text-remote"
                }`}
              >
                {flip.kind === "local" ? t("flipKindLocal") : t("flipKindRemote")}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:contents">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("buyQuick")}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-sm text-text">
              {flip.city}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-lg tabular text-text">
              {formatSilver(flip.citySell)}
            </p>
            <Age date={flip.citySellDate} stale={flip.cityAgeStale || cityRisk} now={now} />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("bmBuys")}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-sm text-text">
              {t("blackMarket")}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-lg tabular text-text">
              {formatSilver(flip.bmBuy)}
            </p>
            <Age date={flip.bmBuyDate} stale={flip.bmAgeStale} now={now} />
            <p className="mt-1 text-[10px] text-muted">{t("qualityMustMatch")}</p>
          </div>

          <div className="lg:text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("youGet")}</p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-sm tabular text-text-dim">
              {t("netLabel", { value: formatSilver(flip.netAfterTax) })}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-medium tabular text-profit">
              {formatSignedSilver(flip.profit)}
            </p>
            <p className="text-[11px] text-muted">
              {t("roiLabel", { value: formatRoi(flip.roi) })}
            </p>
          </div>
        </div>
      </div>

      <CityPricesDropdown open={open} quotes={cityQuotes} now={now} activeCity={flip.city} />
    </article>
  );
}
