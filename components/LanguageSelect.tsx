"use client";

import { LOCALE_OPTIONS, useLocale } from "@/lib/i18n";

export function LanguageSelect() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
      <span className="text-muted">{t("language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        className="max-w-[11rem] bg-transparent font-[family-name:var(--font-mono)] text-text outline-none"
      >
        {LOCALE_OPTIONS.map((o) => (
          <option key={o.locale} value={o.locale}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
