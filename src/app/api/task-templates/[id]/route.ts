import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taskTemplates } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { z } from "zod";

const templateItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  routine: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  category: z.string().optional(),
  sortOrder: z.number().int(),
  offsetDays: z.number().int(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  deadlineSlug: z.string().optional(),
  items: z.array(templateItemSchema).min(1).optional(),
});

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const [template] = await db
    .select()
    .from(taskTemplates)
    .where(
      and(
        eq(taskTemplates.id, id),
        or(
          eq(taskTemplates.tenantId, tenantId),
          and(eq(taskTemplates.isSystem, true), isNull(taskTemplates.tenantId))
        )
      )
    );

  if (!template) {
    return NextResponse.json({ error: "Mal ikke funnet" }, { status: 404 });
  }

  return NextResponse.json(template);
});

export const PUT = withTenant(async (req, { tenantId }, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const [existing] = await db
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));

  if (!existing) {
    return NextResponse.json({ error: "Mal ikke funnet eller du har ikke tilgang" }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json({ error: "Kan ikke redigere systemmaler" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const [updated] = await db
    .update(taskTemplates)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.deadlineSlug !== undefined && { deadlineSlug: data.deadlineSlug }),
      ...(data.items !== undefined && { items: data.items }),
      updatedAt: new Date(),
    })
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withTenant(async (_req, { tenantId }, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const [existing] = await db
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));

  if (!existing) {
    return NextResponse.json({ error: "Mal ikke funnet" }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json({ error: "Kan ikke slette systemmaler" }, { status: 403 });
  }

  await db
    .delete(taskTemplates)
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.tenantId, tenantId)));

  return NextResponse.json({ ok: true });
});
