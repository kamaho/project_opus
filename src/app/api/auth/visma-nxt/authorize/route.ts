import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { getAuthorizationUrl } from "@/lib/visma-nxt/auth";

export const GET = withTenant(async (_req, { tenantId }) => {
  const authUrl = getAuthorizationUrl(tenantId);
  return NextResponse.json({ url: authUrl });
});
