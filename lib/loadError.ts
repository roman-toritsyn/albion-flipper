import type { ApiErrorBody, ApiErrorCode } from "@/lib/apiErrors";
import { isRateLimitError } from "@/lib/apiErrors";

export type LoadError = {
  code: ApiErrorCode | "UNKNOWN";
  message: string;
};

/** Parse flip/craft API failure into a typed load error for UI. */
export function parseLoadError(
  res: Response,
  body: Partial<ApiErrorBody> & { error?: string },
): LoadError {
  const message = body.error || `HTTP ${res.status}`;
  if (body.code === "RATE_LIMITED" || res.status === 429 || isRateLimitError(message)) {
    return { code: "RATE_LIMITED", message };
  }
  if (body.code === "UPSTREAM_ERROR") {
    return { code: "UPSTREAM_ERROR", message };
  }
  return { code: "UNKNOWN", message };
}
