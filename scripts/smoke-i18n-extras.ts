import { MESSAGES } from "../lib/i18n/locales";

const keys = [
  "refineBuySide",
  "refineFamilyLeather",
  "marketInstant",
  "focusOn",
  "dailyBonus",
  "refineManualTitle",
  "navRefine",
  "navUpgrade",
  "upgradeCost",
  "upgradeBuyCityAuto",
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
if (MESSAGES.ru.navUpgrade !== "Апгрейд → BM") {
  throw new Error(`ru navUpgrade: ${MESSAGES.ru.navUpgrade}`);
}
if (MESSAGES.de.upgradeCost === MESSAGES.en.upgradeCost) {
  throw new Error("de upgradeCost still English");
}
console.log("smoke-i18n-extras ok");
