"use client";

import { useLocale } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/types";
import {
  QUALITY_COLORS,
  QUALITY_SHORT,
  isItemQuality,
  type ItemQuality,
} from "@/lib/quality";

type Props = {
  quality: number;
  size?: "sm" | "md";
};

const QUALITY_MSG: Record<ItemQuality, MessageKey> = {
  1: "qNormal",
  2: "qGood",
  3: "qOutstanding",
  4: "qExcellent",
  5: "qMasterpiece",
};

export function QualityBadge({ quality, size = "md" }: Props) {
  const { t } = useLocale();
  const q: ItemQuality = isItemQuality(quality) ? quality : 1;
  const colors = QUALITY_COLORS[q];
  const pad = size === "md" ? "px-2 py-1" : "px-1.5 py-0.5";
  const text = size === "md" ? "text-xs" : "text-[10px]";
  const label = t(QUALITY_MSG[q]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-[family-name:var(--font-display)] font-medium uppercase tracking-wider ${pad} ${text}`}
      style={{
        color: colors.text,
        borderColor: colors.border,
        background: colors.bg,
      }}
      title={label}
    >
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ background: colors.text }}
        aria-hidden
      />
      {QUALITY_SHORT[q]} · {label}
    </span>
  );
}
