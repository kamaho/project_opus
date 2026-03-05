import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthorizationUrl } from "@/lib/visma-nxt/auth";

export async function GET(request: Request) {
  const { orgId } = await auth();
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? orgId;

  if (!tenantId) {
    return NextResponse.json(
      { error: "Missing tenantId" },
      { status: 400 }
    );
  }

  const authUrl = getAuthorizationUrl(tenantId);

  return NextResponse.json({ url: authUrl });
}
