"use client";

import { ageMinutes } from "@/lib/calc";
import { formatSilver } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { formatAgeLabelT } from "@/lib/i18n/formatAge";

export type CityPriceQuote = {
  city: string;
  price: number;
  date: string;
  kind: "city" | "bm";
};

type Props = {
  open: boolean;
  quotes: CityPriceQuote[];
  now: number;
  activeCity?: string;
};

export function CityPricesDropdown({ open, quotes, now, activeCity }: Props) {
  const { t } = useLocale();
  if (!open) return null;

  const bm = quotes.filter((q) => q.kind === "bm");
  const cities = quotes
    .filter((q) => q.kind === "city")
    .slice()
    .sort((a, b) => ageMinutes(a.date, now) - ageMinutes(b.date, now));

  return (
    <div
      className="mt-3 overflow-hidden rounded-md border border-border bg-bg-mid"
      role="listbox"
      aria-label={t("cityPrices")}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="border-b border-border px-3 py-2">
        <p className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.16em] text-muted">
          {t("latestPrices")}
        </p>
      </div>

      <ul className="max-h-72 overflow-y-auto py-1">
        {bm.map((q) => (
          <li
            key={`bm-${q.city}`}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <span className="font-[family-name:var(--font-display)] text-sm text-brass">
              {t("bmBuy")}
            </span>
            <span className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-xs tabular">
              <span className="text-text">{formatSilver(q.price)}</span>
              <span className="min-w-[3.5rem] text-right text-muted">
                {formatAgeLabelT(q.date, now, t)}
              </span>
            </span>
          </li>
        ))}

        {cities.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted">{t("noCityPrices")}</li>
        )}

        {cities.map((q) => {
          const active = q.city === activeCity;
          return (
            <li
              key={q.city}
              className={`flex items-center justify-between gap-3 px-3 py-2 ${
                active ? "bg-surface-hover" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-display)] text-sm text-text">
                  {q.city}
                </span>
                {active && (
                  <span className="rounded-md border border-brass/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-brass">
                    {t("now")}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-xs tabular">
                <span className="text-text">{formatSilver(q.price)}</span>
                <span className="min-w-[3.5rem] text-right text-muted">
                  {formatAgeLabelT(q.date, now, t)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
