import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/api-handler";
import { db, verifyCompanyOwnership } from "@/lib/db";
import { controlConfigs } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { CONTROL_REGISTRY, getControlDefinition } from "@/lib/controls/registry";

const createConfigSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  controlType: z.string(),
  enabled: z.boolean().default(true),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

const updateConfigSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withTenant(async (req: NextRequest, ctx) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");

  const conditions = [eq(controlConfigs.tenantId, ctx.tenantId)];
  if (companyId && companyId !== "__none__") {
    const ids = companyId.split(",").filter((id) => id && id !== "__none__");
    if (ids.length === 1) conditions.push(eq(controlConfigs.companyId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(controlConfigs.companyId, ids));
  }

  const configs = await db
    .select()
    .from(controlConfigs)
    .where(and(...conditions));

  const enriched = configs.map((cfg) => {
    const definition = getControlDefinition(cfg.controlType as any);
    return {
      ...cfg,
      definition: definition
        ? { name: definition.name, description: definition.description, category: definition.category }
        : null,
    };
  });

  return NextResponse.json({ configs: enriched });
});

export const POST = withTenant(async (req: NextRequest, ctx) => {
  const body = await req.json();
  const parsed = createConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { companyId, clientId, controlType, enabled, parameters } = parsed.data;

  await verifyCompanyOwnership(companyId, ctx.tenantId);

  const definition = getControlDefinition(controlType as any);
  if (!definition) {
    return NextResponse.json(
      { error: `Ukjent kontrolltype: ${controlType}` },
      { status: 400 }
    );
  }

  const [config] = await db
    .insert(controlConfigs)
    .values({
      tenantId: ctx.tenantId,
      companyId,
      clientId,
      controlType,
      enabled,
      parameters,
      createdBy: ctx.userId,
    })
    .returning();

  return NextResponse.json({ config }, { status: 201 });
});

export const PATCH = withTenant(async (req: NextRequest, ctx) => {
  const body = await req.json();
  const parsed = updateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, enabled, parameters } = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (enabled !== undefined) updates.enabled = enabled;
  if (parameters !== undefined) updates.parameters = parameters;

  const [updated] = await db
    .update(controlConfigs)
    .set(updates)
    .where(
      and(
        eq(controlConfigs.id, id),
        eq(controlConfigs.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Konfigurasjon ikke funnet" }, { status: 404 });
  }

  return NextResponse.json({ config: updated });
});
