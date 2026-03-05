import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { markOnboardingComplete } from "@/lib/ai/onboarding";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req, { tenantId, userId }) => {
  let options: {
    revizoEnabled?: boolean;
    firstClientCreated?: boolean;
    erpConnected?: boolean;
    userType?: string;
    responsibilities?: string[];
  } = {};

  try {
    const body = await req.json();
    options = {
      revizoEnabled: Boolean(body?.revizoEnabled),
      firstClientCreated: Boolean(body?.erpConnected || body?.firstClientCreated),
      erpConnected: Boolean(body?.erpConnected),
      userType: body?.userType ?? undefined,
      responsibilities: Array.isArray(body?.responsibilities)
        ? body.responsibilities
        : undefined,
    };
  } catch {
    // no body or invalid JSON
  }

  await markOnboardingComplete(userId, tenantId, options);

  return NextResponse.json({ ok: true });
});
