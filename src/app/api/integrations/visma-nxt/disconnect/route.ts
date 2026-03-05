import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { disconnect } from "@/lib/visma-nxt/auth";

export const POST = withTenant(async (_req, { tenantId }) => {
  await disconnect(tenantId);
  return NextResponse.json({ ok: true });
});
