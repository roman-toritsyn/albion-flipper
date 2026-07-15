import { flipKind } from "./calc";
import { qualityKey } from "./quality";
import type { AodpPriceRow, CityLocation, FlipOpportunity } from "./types";
import { BLACK_MARKET, CITY_LOCATIONS } from "./types";

const CITY_SET = new Set<string>(CITY_LOCATIONS);

function isCity(location: string): location is CityLocation {
  return CITY_SET.has(location);
}

/**
 * Build flip opportunities: buy via city sell_price_min, sell via BM buy_price_max.
 * City and BM must share the same itemId AND quality — never cross qualities.
 */
export function buildFlips(rows: AodpPriceRow[]): FlipOpportunity[] {
  // key: itemId::quality → location → row
  const byItemQuality = new Map<string, Map<string, AodpPriceRow>>();

  for (const row of rows) {
    if (!row.item_id) continue;
    const quality = row.quality || 1;
    const key = qualityKey(row.item_id, quality);
    let locMap = byItemQuality.get(key);
    if (!locMap) {
      locMap = new Map();
      byItemQuality.set(key, locMap);
    }
    locMap.set(row.city, row);
  }

  const flips: FlipOpportunity[] = [];

  for (const [, locMap] of byItemQuality) {
    const bm = locMap.get(BLACK_MARKET);
    if (!bm || !(bm.buy_price_max > 0)) continue;

    const itemId = bm.item_id;
    const quality = bm.quality || 1;

    for (const city of CITY_LOCATIONS) {
      const cityRow = locMap.get(city);
      if (!cityRow || !(cityRow.sell_price_min > 0)) continue;
      if (!isCity(city)) continue;
      // Defensive: never mix qualities
      if ((cityRow.quality || 1) !== quality) continue;

      flips.push({
        itemId,
        quality,
        city,
        citySell: cityRow.sell_price_min,
        citySellDate: cityRow.sell_price_min_date,
        bmBuy: bm.buy_price_max,
        bmBuyDate: bm.buy_price_max_date,
        kind: flipKind(city),
      });
    }
  }

  return flips;
}
