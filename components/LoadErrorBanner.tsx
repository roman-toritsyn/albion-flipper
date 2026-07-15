"use client";

import { useLocale } from "@/lib/i18n";
import type { LoadError } from "@/lib/loadError";

type Props = {
  error: LoadError;
  onRetry?: () => void;
};

export function LoadErrorBanner({ error, onRetry }: Props) {
  const { t } = useLocale();
  const isRateLimit = error.code === "RATE_LIMITED";

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-md border border-danger/40 bg-danger/5 px-4 py-10 text-center"
    >
      <p className="font-[family-name:var(--font-display)] text-lg text-danger">
        {isRateLimit ? t("rateLimited") : t("loadFailed", { error: error.message })}
      </p>
      {isRateLimit && (
        <p className="max-w-md font-[family-name:var(--font-mono)] text-xs text-text-dim">
          {t("rateLimitedHint")}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text transition-colors hover:border-brass hover:text-brass"
        >
          {t("refresh")}
        </button>
      )}
    </div>
  );
}
