import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchingRules, companies, clients } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createRuleSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().min(1),
  ruleType: z.enum(["one_to_one", "many_to_one", "many_to_many"]),
  isInternal: z.boolean().default(false),
  dateMustMatch: z.boolean().default(true),
  dateToleranceDays: z.number().int().min(0).default(0),
  compareCurrency: z.enum(["local", "foreign"]).default("local"),
  allowTolerance: z.boolean().default(false),
  toleranceAmount: z.string().default("0"),
  conditions: z.array(z.any()).default([]),
  isActive: z.boolean().default(true),
});

const updateRuleSchema = createRuleSchema.partial();

async function getTenantId(clientId: string, orgId: string): Promise<string | null> {
  const row = await validateClientTenant(clientId, orgId);
  return row ? orgId : null;
}

/**
 * GET: List all matching rules for a client, sorted by priority.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const tenantId = await getTenantId(clientId, orgId);
  if (!tenantId) return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });

  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.clientId, clientId))
    .orderBy(asc(matchingRules.priority));

  return NextResponse.json(rules);
}

/**
 * POST: Create a new matching rule.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const tenantId = await getTenantId(clientId, orgId);
  if (!tenantId) return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig data", details: parsed.error.flatten() }, { status: 400 });
  }

  const [rule] = await db
    .insert(matchingRules)
    .values({
      clientId,
      tenantId,
      ...parsed.data,
    })
    .returning();

  await logAudit({ tenantId, userId, action: "rule.created", entityType: "matching_rule", entityId: rule.id });

  return NextResponse.json(rule, { status: 201 });
}

/**
 * PATCH: Update a matching rule.
 * Query param: ?ruleId=uuid
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const tenantId = await getTenantId(clientId, orgId);
  if (!tenantId) return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });

  const url = new URL(request.url);
  const ruleId = url.searchParams.get("ruleId");
  if (!ruleId) return NextResponse.json({ error: "Mangler ruleId" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = updateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig data", details: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(matchingRules)
    .set(parsed.data)
    .where(and(eq(matchingRules.id, ruleId), eq(matchingRules.clientId, clientId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Regel ikke funnet" }, { status: 404 });

  await logAudit({ tenantId, userId, action: "rule.updated", entityType: "matching_rule", entityId: ruleId });

  return NextResponse.json(updated);
}

/**
 * DELETE: Delete a matching rule.
 * Query param: ?ruleId=uuid
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const tenantId = await getTenantId(clientId, orgId);
  if (!tenantId) return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });

  const url = new URL(request.url);
  const ruleId = url.searchParams.get("ruleId");
  if (!ruleId) return NextResponse.json({ error: "Mangler ruleId" }, { status: 400 });

  const [deleted] = await db
    .delete(matchingRules)
    .where(and(eq(matchingRules.id, ruleId), eq(matchingRules.clientId, clientId)))
    .returning({ id: matchingRules.id });

  if (!deleted) return NextResponse.json({ error: "Regel ikke funnet" }, { status: 404 });

  await logAudit({ tenantId, userId, action: "rule.deleted", entityType: "matching_rule", entityId: ruleId });

  return NextResponse.json({ ok: true });
}
