import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchingRules } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
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

/**
 * GET: List all matching rules for a client, sorted by priority.
 */
export const GET = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.clientId, clientId))
    .orderBy(asc(matchingRules.priority));

  return NextResponse.json(rules);
});

/**
 * POST: Create a new matching rule.
 */
export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const body = await req.json().catch(() => ({}));
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
});

/**
 * PATCH: Update a matching rule.
 * Query param: ?ruleId=uuid
 */
export const PATCH = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const url = new URL(req.url);
  const ruleId = url.searchParams.get("ruleId");
  if (!ruleId) return NextResponse.json({ error: "Mangler ruleId" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
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
});

/**
 * DELETE: Delete a matching rule.
 * Query param: ?ruleId=uuid
 */
export const DELETE = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const url = new URL(req.url);
  const ruleId = url.searchParams.get("ruleId");
  if (!ruleId) return NextResponse.json({ error: "Mangler ruleId" }, { status: 400 });

  const [deleted] = await db
    .delete(matchingRules)
    .where(and(eq(matchingRules.id, ruleId), eq(matchingRules.clientId, clientId)))
    .returning({ id: matchingRules.id });

  if (!deleted) return NextResponse.json({ error: "Regel ikke funnet" }, { status: 404 });

  await logAudit({ tenantId, userId, action: "rule.deleted", entityType: "matching_rule", entityId: ruleId });

  return NextResponse.json({ ok: true });
});
