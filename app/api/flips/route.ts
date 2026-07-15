import { fetchEuropePrices } from "@/lib/aodp";
import { upstreamErrorResponse } from "@/lib/apiErrors";
import { getOrFetchPrices } from "@/lib/cache";
import { buildFlips } from "@/lib/flips";
import { ITEM_IDS } from "@/lib/items";
import type { FlipsResponse } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  try {
    const result = await getOrFetchPrices(() => fetchEuropePrices(ITEM_IDS), {
      fresh,
    });

    const flips = buildFlips(result.data);

    const body: FlipsResponse = {
      flips,
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
    console.error("[api/flips]", message);
    return upstreamErrorResponse(err);
  }
}
