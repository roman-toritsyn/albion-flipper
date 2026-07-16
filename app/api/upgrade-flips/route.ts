import { fetchBrecilienPrices, fetchCityBmPrices } from "@/lib/aodp";
import { upstreamErrorResponse } from "@/lib/apiErrors";
import { getOrFetchUpgradePrices } from "@/lib/cache";
import { upgradePriceItemIds } from "@/lib/upgradeFlips";
import type { UpgradeFlipsResponse } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPGRADE_ITEM_IDS = upgradePriceItemIds();

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  try {
    const result = await getOrFetchUpgradePrices(
      UPGRADE_ITEM_IDS,
      {
        fetchCityBm: (ids) => fetchCityBmPrices(ids),
        fetchBrecilien: (ids) => fetchBrecilienPrices(ids),
      },
      { fresh },
    );

    const body: UpgradeFlipsResponse = {
      rows: result.data,
      fetchedAt: result.fetchedAt,
      expiresAt: result.expiresAt,
      cacheHit: result.cacheHit,
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=240, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/upgrade-flips]", message);
    return upstreamErrorResponse(err);
  }
}
