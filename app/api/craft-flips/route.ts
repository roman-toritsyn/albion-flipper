import { fetchCraftPrices } from "@/lib/aodp";
import { upstreamErrorResponse } from "@/lib/apiErrors";
import { getOrFetchCraftPrices } from "@/lib/cache";
import { buildCraftFlipsByMode, craftPriceItemIds } from "@/lib/craftFlips";
import type { CraftFlipsResponse } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRAFT_ITEM_IDS = craftPriceItemIds();

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  try {
    const result = await getOrFetchCraftPrices(
      CRAFT_ITEM_IDS,
      (ids) => fetchCraftPrices(ids),
      { fresh },
    );

    const body: CraftFlipsResponse = {
      flipsByMode: buildCraftFlipsByMode(result.data),
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
    console.error("[api/craft-flips]", message);
    return upstreamErrorResponse(err);
  }
}
