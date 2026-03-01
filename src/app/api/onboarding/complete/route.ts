import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { markOnboardingComplete } from "@/lib/ai/onboarding";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  await markOnboardingComplete(userId, orgId ?? null, options);
  return NextResponse.json({ ok: true });
}
