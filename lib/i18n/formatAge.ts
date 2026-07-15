import { ageMinutes } from "@/lib/calc";
import type { MessageKey } from "@/lib/i18n/types";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function formatAgeLabelT(
  dateIso: string,
  nowMs: number,
  t: TFn,
): string {
  const mins = ageMinutes(dateIso, nowMs);
  if (!Number.isFinite(mins)) return t("ageNoData");
  if (mins < 1) return t("ageLt1m");
  if (mins < 60) return t("ageMinutes", { n: Math.floor(mins) });
  const hours = mins / 60;
  if (hours < 24) return t("ageHours", { n: Math.floor(hours) });
  return t("ageDays", { n: Math.floor(hours / 24) });
}
