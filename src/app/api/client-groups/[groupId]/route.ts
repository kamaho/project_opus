import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientGroups, clientGroupMembers, clients, companies } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const patchGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  clientIds: z.array(z.string().uuid()).min(2).optional(),
  assignedUserId: z.string().nullable().optional(),
});

export const DELETE = withTenant(async (_req, { tenantId, userId }, params) => {
  const groupId = params!.groupId;

  const [group] = await db
    .select({ id: clientGroups.id })
    .from(clientGroups)
    .where(and(eq(clientGroups.id, groupId), eq(clientGroups.tenantId, tenantId)));

  if (!group) return NextResponse.json({ error: "Gruppe ikke funnet" }, { status: 404 });

  await db.delete(clientGroups).where(eq(clientGroups.id, groupId));

  await logAudit({ tenantId, userId, action: "group.deleted", entityType: "client_group", entityId: groupId });

  return NextResponse.json({ ok: true });
});

export const PATCH = withTenant(async (req, { tenantId }, params) => {
  const groupId = params!.groupId;

  const [group] = await db
    .select({ id: clientGroups.id })
    .from(clientGroups)
    .where(and(eq(clientGroups.id, groupId), eq(clientGroups.tenantId, tenantId)));

  if (!group) return NextResponse.json({ error: "Gruppe ikke funnet" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });

  const parsed = patchGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldig data" },
      { status: 400 }
    );
  }
  const { name, description, color, icon, clientIds, assignedUserId } = parsed.data;

  const updates: Partial<{ name: string; description: string | null; color: string | null; icon: string | null; assignedUserId: string | null }> = {};
  if (name?.trim()) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (color !== undefined) updates.color = color?.trim() || null;
  if (icon !== undefined) updates.icon = icon?.trim() || null;
  if (assignedUserId !== undefined) updates.assignedUserId = assignedUserId;

  if (Object.keys(updates).length > 0) {
    await db.update(clientGroups).set(updates).where(eq(clientGroups.id, groupId));
  }

  if (clientIds && clientIds.length >= 2) {
    const validClients = await db
      .select({ id: clients.id })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(and(eq(companies.tenantId, tenantId), inArray(clients.id, clientIds)));

    if (validClients.length !== clientIds.length) {
      return NextResponse.json({ error: "En eller flere klienter ble ikke funnet" }, { status: 404 });
    }

    await db.delete(clientGroupMembers).where(eq(clientGroupMembers.groupId, groupId));
    await db.insert(clientGroupMembers).values(
      clientIds.map((cid) => ({ groupId, clientId: cid }))
    );
  }

  return NextResponse.json({ ok: true });
});
