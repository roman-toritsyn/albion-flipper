import { NextResponse } from "next/server";

export type ApiErrorCode = "RATE_LIMITED" | "UPSTREAM_ERROR";

export type ApiErrorBody = {
  error: string;
  code: ApiErrorCode;
};

export function isRateLimitError(message: string): boolean {
  return /AODP HTTP 429/i.test(message) || /\b429\b/.test(message);
}

/** Map upstream/AODP failures to a JSON error the UI can localize. */
export function upstreamErrorResponse(err: unknown): NextResponse<ApiErrorBody> {
  const message = err instanceof Error ? err.message : "Unknown error";
  const rateLimited = isRateLimitError(message);
  return NextResponse.json(
    {
      error: message,
      code: rateLimited ? "RATE_LIMITED" : "UPSTREAM_ERROR",
    },
    { status: rateLimited ? 429 : 502 },
  );
}
