import { withTenant } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tutorialSteps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isSystemAdmin } from "@/lib/auth/is-system-admin";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

const stepSchema = z.object({
  elementSelector: z.string().min(1, "elementSelector er påkrevd"),
  title: z.string().min(1, "title er påkrevd").max(200),
  description: z.string().max(1000).optional(),
  pathname: z.string().max(500).optional(),
  tooltipPosition: z.enum(["top", "bottom", "left", "right"]).default("bottom"),
});

const bodySchema = z.object({
  steps: z.array(stepSchema),
});

export const PUT = withTenant(async (req, _ctx, params) => {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSystemAdmin(user.emailAddresses[0]?.emailAddress)) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const tutorialId = params!.tutorialId;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return zodError(parsed.error);

  const { steps } = parsed.data;

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
        tooltipPosition: s.tooltipPosition,
      }))
    );
  }

  return NextResponse.json({ ok: true });
});
