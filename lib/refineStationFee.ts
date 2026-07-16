/**
 * Albion refining station usage fee from Item Value / nutrition.
 *
 * nutrition = itemValue × 0.1125
 * stationFee = nutrition × (usageFeePer100 / 100)
 *
 * For refine (material amount = 1, no artifacts):
 * itemValue = 16 × 2^(tier − 4) × 2^enchant
 *
 * T2 and below pay no usage fee (wiki: Building).
 */

/** Nutrition consumed per unit of Item Value. */
export const NUTRITION_PER_ITEM_VALUE = 0.1125;

/** Base material value factor at T4.0 (Material Amount × 16). */
export const REFINE_BASE_ITEM_VALUE = 16;

/**
 * NPC Item Value for one refined resource craft output.
 * Returns 0 for invalid / non-fee tiers (≤2).
 */
export function refineItemValue(tier: number, enchant: number = 0): number {
  if (!(tier > 2) || !Number.isFinite(tier) || !Number.isFinite(enchant)) {
    return 0;
  }
  const ench = Math.max(0, Math.floor(enchant));
  return REFINE_BASE_ITEM_VALUE * 2 ** (tier - 4) * 2 ** ench;
}

/** Nutrition consumed for one refine craft. */
export function refineNutrition(tier: number, enchant: number = 0): number {
  return refineItemValue(tier, enchant) * NUTRITION_PER_ITEM_VALUE;
}

/**
 * Silver paid to the station for one refine craft.
 * `usageFeePer100` is the in-game "silver per 100 nutrition" setting.
 */
export function refineStationFee(
  tier: number,
  enchant: number,
  usageFeePer100: number,
): number {
  if (!(usageFeePer100 > 0) || !(tier > 2)) return 0;
  const nutrition = refineNutrition(tier, enchant);
  if (!(nutrition > 0)) return 0;
  return nutrition * (usageFeePer100 / 100);
}
