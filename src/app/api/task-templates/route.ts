import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taskTemplates } from "@/lib/db/schema";
import { eq, or, and, isNull } from "drizzle-orm";
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

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  deadlineSlug: z.string().optional(),
  items: z.array(templateItemSchema).min(1),
});

export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  const conditions = or(
    eq(taskTemplates.tenantId, tenantId),
    and(eq(taskTemplates.isSystem, true), isNull(taskTemplates.tenantId))
  )!;

  let rows;
  if (slug) {
    rows = await db
      .select()
      .from(taskTemplates)
      .where(and(conditions, eq(taskTemplates.deadlineSlug, slug)))
      .orderBy(taskTemplates.name);
  } else {
    rows = await db
      .select()
      .from(taskTemplates)
      .where(conditions)
      .orderBy(taskTemplates.name);
  }

  return NextResponse.json(rows);
});

export const POST = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const [created] = await db
    .insert(taskTemplates)
    .values({
      tenantId,
      name: data.name,
      description: data.description,
      deadlineSlug: data.deadlineSlug,
      isSystem: false,
      items: data.items,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});
