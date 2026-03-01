import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dashboardConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  dashboardType: z.enum(["agency", "client"]),
  layout: z.enum(["overview", "compact", "focus"]).optional(),
  hiddenModules: z.array(z.string()).optional(),
  moduleSettings: z.record(z.string(), z.unknown()).optional(),
});

const DEFAULT_CONFIG = {
  layout: "overview" as const,
  hiddenModules: [] as string[],
  moduleSettings: {} as Record<string, unknown>,
};

export const GET = withTenant(async (req, { tenantId, userId }) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (!type || !["agency", "client"].includes(type)) {
    return NextResponse.json(
      { error: "Missing or invalid 'type' query param" },
      { status: 400 }
    );
  }

  const [row] = await db
    .select()
    .from(dashboardConfigs)
    .where(
      and(
        eq(dashboardConfigs.tenantId, tenantId),
        eq(dashboardConfigs.userId, userId),
        eq(dashboardConfigs.dashboardType, type)
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json(DEFAULT_CONFIG);
  }

  return NextResponse.json({
    layout: row.layout,
    hiddenModules: row.hiddenModules ?? [],
    moduleSettings: row.moduleSettings ?? {},
  });
});

export const PUT = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { dashboardType, layout, hiddenModules, moduleSettings } = parsed.data;

  const [existing] = await db
    .select()
    .from(dashboardConfigs)
    .where(
      and(
        eq(dashboardConfigs.tenantId, tenantId),
        eq(dashboardConfigs.userId, userId),
        eq(dashboardConfigs.dashboardType, dashboardType)
      )
    )
    .limit(1);

  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (layout !== undefined) updates.layout = layout;
    if (hiddenModules !== undefined) updates.hiddenModules = hiddenModules;
    if (moduleSettings !== undefined) updates.moduleSettings = moduleSettings;

    await db
      .update(dashboardConfigs)
      .set(updates)
      .where(eq(dashboardConfigs.id, existing.id));
  } else {
    await db.insert(dashboardConfigs).values({
      tenantId,
      userId,
      dashboardType,
      layout: layout ?? "overview",
      hiddenModules: hiddenModules ?? [],
      moduleSettings: moduleSettings ?? {},
    });
  }

  return NextResponse.json({ ok: true });
});
