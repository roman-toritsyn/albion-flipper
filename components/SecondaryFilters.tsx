"use client";

import { useLocale } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/types";
import { QUALITIES, QUALITY_SHORT, type ItemQuality } from "@/lib/quality";
import { CITY_LOCATIONS, ROYAL_CITIES, type CityLocation } from "@/lib/types";

/** all · royal group · or a single city */
export type CityFilter = "all" | "royal" | CityLocation;

export type QualityFilter = "all" | ItemQuality;

type Props = {
  taxRate: number;
  maxAge: number;
  city: CityFilter;
  quality: QualityFilter;
  onTaxRate: (v: number) => void;
  onMaxAge: (v: number) => void;
  onCity: (v: CityFilter) => void;
  onQuality: (v: QualityFilter) => void;
};

const QUALITY_MSG: Record<ItemQuality, MessageKey> = {
  1: "qNormal",
  2: "qGood",
  3: "qOutstanding",
  4: "qExcellent",
  5: "qMasterpiece",
};

function parseCityFilter(value: string): CityFilter {
  if (value === "all" || value === "royal") return value;
  if ((CITY_LOCATIONS as readonly string[]).includes(value)) {
    return value as CityLocation;
  }
  return "all";
}

export function SecondaryFilters({
  taxRate,
  maxAge,
  city,
  quality,
  onTaxRate,
  onMaxAge,
  onCity,
  onQuality,
}: Props) {
  const { t } = useLocale();

  return (
    <section className="flex flex-wrap gap-3 text-sm">
      <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <span className="text-muted">{t("city")}</span>
        <select
          value={city}
          onChange={(e) => onCity(parseCityFilter(e.target.value))}
          className="bg-transparent font-[family-name:var(--font-mono)] text-text outline-none"
        >
          <option value="all">{t("allCities")}</option>
          <option value="royal">{t("royal")}</option>
          <optgroup label={t("royalSeparate")}>
            {ROYAL_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("blackZone")}>
            <option value="Caerleon">Caerleon</option>
          </optgroup>
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <span className="text-muted">{t("quality")}</span>
        <select
          value={quality === "all" ? "all" : String(quality)}
          onChange={(e) => {
            const v = e.target.value;
            onQuality(v === "all" ? "all" : (Number(v) as ItemQuality));
          }}
          className="bg-transparent font-[family-name:var(--font-mono)] text-text outline-none"
        >
          <option value="all">{t("allQualities")}</option>
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {QUALITY_SHORT[q]} · {t(QUALITY_MSG[q])}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <span className="text-muted">{t("tax")}</span>
        <select
          value={taxRate}
          onChange={(e) => onTaxRate(Number(e.target.value))}
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
          onChange={(e) => onMaxAge(Number(e.target.value))}
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
  );
}
