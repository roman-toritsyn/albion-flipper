import { fetchRefinePrices } from "@/lib/aodp";
import { upstreamErrorResponse } from "@/lib/apiErrors";
import { getOrFetchRefinePrices } from "@/lib/cache";
import { refinePriceItemIds } from "@/lib/refineFlips";
import type { RefineFlipsResponse } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REFINE_ITEM_IDS = refinePriceItemIds();

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  try {
    const result = await getOrFetchRefinePrices(
      () => fetchRefinePrices(REFINE_ITEM_IDS),
      { fresh },
    );

    const body: RefineFlipsResponse = {
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
    console.error("[api/refine-flips]", message);
    return upstreamErrorResponse(err);
  }
}
