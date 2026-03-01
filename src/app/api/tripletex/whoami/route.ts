import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { tripletexWhoAmI } from "@/lib/tripletex";

export const dynamic = "force-dynamic";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await tripletexWhoAmI(orgId);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
