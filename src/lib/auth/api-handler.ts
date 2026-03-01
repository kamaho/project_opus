import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireTenant, type TenantContext } from "./tenant";

type ApiHandler = (
  req: NextRequest,
  ctx: TenantContext,
  params?: Record<string, string>
) => Promise<NextResponse | Response>;

/**
 * Wrapper for API-ruter som:
 * 1. Kjører requireTenant() automatisk
 * 2. Fanger AuthError og returnerer riktig HTTP-status
 * 3. Fanger uventede feil og returnerer 500 uten å lekke detaljer
 */
export function withTenant(handler: ApiHandler) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ) => {
    try {
      const tenant = await requireTenant();
      const params = context?.params ? await context.params : undefined;
      return await handler(req, tenant, params);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      console.error("[api] Unhandled error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
