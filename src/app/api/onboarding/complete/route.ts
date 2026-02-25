import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { markOnboardingComplete } from "@/lib/ai/onboarding";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let revizoEnabled = false;
  try {
    const body = await req.json();
    revizoEnabled = Boolean(body?.revizoEnabled);
  } catch {
    // no body or invalid JSON
  }
  await markOnboardingComplete(userId, orgId ?? null, revizoEnabled);
  return NextResponse.json({ ok: true });
}
