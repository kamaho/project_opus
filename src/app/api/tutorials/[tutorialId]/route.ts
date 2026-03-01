import { withTenant } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tutorials, tutorialSteps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isSystemAdmin } from "@/lib/auth/is-system-admin";

export const GET = withTenant(async (_req, _ctx, params) => {
  const tutorialId = params!.tutorialId;

  const [tutorial] = await db
    .select()
    .from(tutorials)
    .where(eq(tutorials.id, tutorialId));

  if (!tutorial) {
    return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  }

  const steps = await db
    .select()
    .from(tutorialSteps)
    .where(eq(tutorialSteps.tutorialId, tutorialId))
    .orderBy(tutorialSteps.stepOrder);

  return NextResponse.json({ ...tutorial, steps });
});

export const PATCH = withTenant(async (req, _ctx, params) => {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSystemAdmin(user.emailAddresses[0]?.emailAddress)) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const tutorialId = params!.tutorialId;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });

  const { name, description, pathnamePattern, visibility, isPublished } = body as {
    name?: string;
    description?: string;
    pathnamePattern?: string;
    visibility?: "all" | "specific";
    isPublished?: boolean;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name?.trim()) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (pathnamePattern?.trim()) updates.pathnamePattern = pathnamePattern.trim();
  if (visibility) updates.visibility = visibility;
  if (isPublished !== undefined) updates.isPublished = isPublished;

  await db.update(tutorials).set(updates).where(eq(tutorials.id, tutorialId));

  return NextResponse.json({ ok: true });
});

export const DELETE = withTenant(async (_req, _ctx, params) => {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSystemAdmin(user.emailAddresses[0]?.emailAddress)) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const tutorialId = params!.tutorialId;
  await db.delete(tutorials).where(eq(tutorials.id, tutorialId));

  return NextResponse.json({ ok: true });
});
