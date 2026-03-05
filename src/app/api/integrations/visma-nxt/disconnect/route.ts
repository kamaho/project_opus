import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { disconnect } from "@/lib/visma-nxt/auth";

export async function POST() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await disconnect(orgId);

  return NextResponse.json({ ok: true });
}
