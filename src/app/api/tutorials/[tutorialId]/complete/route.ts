import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tutorialCompletions } from "@/lib/db/schema";

export const POST = withTenant(async (_req, { userId }, params) => {
  const tutorialId = params!.tutorialId;

  await db
    .insert(tutorialCompletions)
    .values({ tutorialId, userId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
});
