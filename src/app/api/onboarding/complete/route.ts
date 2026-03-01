import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { markOnboardingComplete } from "@/lib/ai/onboarding";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req, { tenantId, userId }) => {
  let options: {
    revizoEnabled?: boolean;
    firstClientCreated?: boolean;
    erpConnected?: boolean;
  } = {};

  try {
    const body = await req.json();
    options = {
      revizoEnabled: Boolean(body?.revizoEnabled),
      firstClientCreated: Boolean(body?.erpConnected || body?.firstClientCreated),
      erpConnected: Boolean(body?.erpConnected),
    };
  } catch {
    // no body or invalid JSON
  }

  await markOnboardingComplete(userId, tenantId, options);
  return NextResponse.json({ ok: true });
});
