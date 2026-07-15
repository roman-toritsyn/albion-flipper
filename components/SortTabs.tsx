"use client";

import { useLocale } from "@/lib/i18n";

export type SortTab = "profit" | "fresh";

type Props = {
  value: SortTab;
  onChange: (value: SortTab) => void;
};

export function SortTabs({ value, onChange }: Props) {
  const { t } = useLocale();
  const tabs: { id: SortTab; label: string; hint: string }[] = [
    { id: "profit", label: t("bestProfit"), hint: t("hintProfit") },
    { id: "fresh", label: t("freshest"), hint: t("hintAge") },
  ];

  return (
    <div className="w-full">
      <p className="mb-2 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-muted">
        {t("list")}
      </p>
      <div className="inline-flex w-full max-w-md rounded-md border border-border bg-surface p-1 sm:w-auto">
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex min-w-0 flex-1 flex-col items-start rounded-md px-3 py-2 text-left transition-colors sm:flex-none sm:min-w-[10rem] ${
                active
                  ? "bg-brass text-[#1a1405]"
                  : "text-text-dim hover:text-text"
              }`}
            >
              <span className="font-[family-name:var(--font-display)] text-sm font-medium">
                {tab.label}
              </span>
              <span
                className={`font-[family-name:var(--font-mono)] text-[10px] ${
                  active ? "text-[#1a1405]/80" : "text-muted"
                }`}
              >
                {tab.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
