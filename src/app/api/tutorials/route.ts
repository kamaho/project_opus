import { withTenant } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tutorials, tutorialSteps, tutorialCompletions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { isSystemAdmin } from "@/lib/auth/is-system-admin";
import { matchPathname } from "@/lib/tutorial/pathname-matcher";

export const GET = withTenant(async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const pathname = searchParams.get("pathname");

  const allTutorials = await db
    .select({
      id: tutorials.id,
      name: tutorials.name,
      description: tutorials.description,
      pathnamePattern: tutorials.pathnamePattern,
      visibility: tutorials.visibility,
      isPublished: tutorials.isPublished,
      createdByUserId: tutorials.createdByUserId,
      createdAt: tutorials.createdAt,
      stepCount: sql<number>`(SELECT count(*) FROM tutorial_steps WHERE tutorial_id = ${tutorials.id})::int`,
    })
    .from(tutorials)
    .where(eq(tutorials.isPublished, true))
    .orderBy(tutorials.createdAt);

  let filtered = allTutorials;
  if (pathname) {
    filtered = allTutorials.filter((t) =>
      matchPathname(t.pathnamePattern, pathname)
    );
  }

  const completions = await db
    .select({ tutorialId: tutorialCompletions.tutorialId })
    .from(tutorialCompletions)
    .where(eq(tutorialCompletions.userId, userId));
  const completedSet = new Set(completions.map((c) => c.tutorialId));

  const result = filtered.map((t) => ({
    ...t,
    completed: completedSet.has(t.id),
  }));

  return NextResponse.json(result);
});

export const POST = withTenant(async (req) => {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSystemAdmin(user.emailAddresses[0]?.emailAddress)) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.pathnamePattern) {
    return NextResponse.json({ error: "Navn og pathname kreves" }, { status: 400 });
  }

  const { name, description, pathnamePattern, visibility, steps } = body as {
    name: string;
    description?: string;
    pathnamePattern: string;
    visibility?: "all" | "specific";
    steps?: {
      elementSelector: string;
      title: string;
      description?: string;
      pathname?: string;
      tooltipPosition?: string;
    }[];
  };

  const [tutorial] = await db
    .insert(tutorials)
    .values({
      name: name.trim(),
      description: description?.trim() || null,
      pathnamePattern: pathnamePattern.trim(),
      createdByUserId: user.id,
      visibility: visibility ?? "all",
      isPublished: true,
    })
    .returning();

  if (steps && steps.length > 0) {
    await db.insert(tutorialSteps).values(
      steps.map((s, i) => ({
        tutorialId: tutorial.id,
        stepOrder: i + 1,
        elementSelector: s.elementSelector,
        title: s.title,
        description: s.description || null,
        pathname: s.pathname || null,
        tooltipPosition: (s.tooltipPosition as "top" | "bottom" | "left" | "right") ?? "bottom",
      }))
    );
  }

  return NextResponse.json(tutorial, { status: 201 });
});
