import { MESSAGES } from "../lib/i18n/locales";

const keys = [
  "refineBuySide",
  "refineFamilyLeather",
  "marketInstant",
  "focusOn",
  "dailyBonus",
  "refineManualTitle",
  "navRefine",
  "taxPremium",
  "netAbbrev",
  "refineManualFillMarket",
] as const;

for (const locale of ["ru", "de", "pl"] as const) {
  const m = MESSAGES[locale];
  console.log(locale, Object.fromEntries(keys.map((k) => [k, m[k]])));
}

if (MESSAGES.ru.refineFamilyLeather === MESSAGES.en.refineFamilyLeather) {
  throw new Error("ru leather still English");
}
if (MESSAGES.ru.refineManualFillMarket === MESSAGES.en.refineManualFillMarket) {
  throw new Error("ru fill still English");
}
console.log("smoke-i18n-extras ok");
