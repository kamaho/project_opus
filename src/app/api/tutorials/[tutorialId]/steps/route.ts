import { withTenant } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tutorialSteps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isSystemAdmin } from "@/lib/auth/is-system-admin";

export const PUT = withTenant(async (req, _ctx, params) => {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSystemAdmin(user.emailAddresses[0]?.emailAddress)) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const tutorialId = params!.tutorialId;
  const body = await req.json().catch(() => null);
  if (!body?.steps || !Array.isArray(body.steps)) {
    return NextResponse.json({ error: "steps array kreves" }, { status: 400 });
  }

  const { steps } = body as {
    steps: {
      elementSelector: string;
      title: string;
      description?: string;
      pathname?: string;
      tooltipPosition?: string;
    }[];
  };

  await db.delete(tutorialSteps).where(eq(tutorialSteps.tutorialId, tutorialId));

  if (steps.length > 0) {
    await db.insert(tutorialSteps).values(
      steps.map((s, i) => ({
        tutorialId,
        stepOrder: i + 1,
        elementSelector: s.elementSelector,
        title: s.title,
        description: s.description || null,
        pathname: s.pathname || null,
        tooltipPosition: (s.tooltipPosition as "top" | "bottom" | "left" | "right") ?? "bottom",
      }))
    );
  }

  return NextResponse.json({ ok: true });
});
