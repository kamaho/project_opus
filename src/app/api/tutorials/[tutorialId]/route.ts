import { withTenant } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tutorials, tutorialSteps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isSystemAdmin } from "@/lib/auth/is-system-admin";
import { z } from "zod";

const patchTutorialSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  pathnamePattern: z.string().min(1).max(500).optional(),
  visibility: z.enum(["all", "specific"]).optional(),
  isPublished: z.boolean().optional(),
});

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

  const parsed = patchTutorialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldig data" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) updates.description = parsed.data.description?.trim() || null;
  if (parsed.data.pathnamePattern) updates.pathnamePattern = parsed.data.pathnamePattern.trim();
  if (parsed.data.visibility) updates.visibility = parsed.data.visibility;
  if (parsed.data.isPublished !== undefined) updates.isPublished = parsed.data.isPublished;

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
