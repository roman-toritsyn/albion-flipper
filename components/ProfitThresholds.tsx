"use client";

import { useLocale } from "@/lib/i18n";
import { PROFIT_THRESHOLDS } from "@/lib/thresholds";

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export function ProfitThresholds({ value, onChange }: Props) {
  const { t } = useLocale();

  return (
    <div className="w-full">
      <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
        {t("minProfit")}
      </p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        {PROFIT_THRESHOLDS.map((threshold) => {
          const active = threshold.value === value;
          const label =
            threshold.value === 0 ? t("thresholdAll") : threshold.label;
          return (
            <button
              key={threshold.label}
              type="button"
              onClick={() => onChange(threshold.value)}
              className={`snap-start shrink-0 rounded-md border px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs tabular transition-colors ${
                active
                  ? "border-brass bg-brass text-[#1a1405]"
                  : "border-border bg-surface text-text-dim hover:border-brass-dim hover:text-text"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
