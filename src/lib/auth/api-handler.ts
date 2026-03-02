import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTenant, type TenantContext } from "./tenant";
import { applyGlobalRateLimit } from "../rate-limit";

type ApiHandler = (
  req: NextRequest,
  ctx: TenantContext,
  params?: Record<string, string>
) => Promise<NextResponse | Response>;

/**
 * Wrapper for API-ruter som:
 * 1. Kjører requireTenant() automatisk
 * 2. Appliserer global rate limiting
 * 3. Fanger AuthError og returnerer riktig HTTP-status
 * 4. Fanger uventede feil og returnerer 500 uten å lekke detaljer
 */
export function withTenant(handler: ApiHandler) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ) => {
    try {
      const tenant = await requireTenant();

      const rateLimitResponse = applyGlobalRateLimit(
        tenant.userId,
        req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        req.method
      );
      if (rateLimitResponse) return rateLimitResponse;

      const params = context?.params ? await context.params : undefined;
      return await handler(req, tenant, params);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      console.error("[api] Unhandled error:", error instanceof Error ? error.message : error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
