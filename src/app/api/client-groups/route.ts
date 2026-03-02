import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientGroups, clientGroupMembers, clients, companies } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export const GET = withTenant(async (_req, { tenantId }) => {
  const groups = await db
    .select({
      id: clientGroups.id,
      name: clientGroups.name,
      description: clientGroups.description,
      assignedUserId: clientGroups.assignedUserId,
      createdAt: clientGroups.createdAt,
    })
    .from(clientGroups)
    .where(eq(clientGroups.tenantId, tenantId))
    .orderBy(clientGroups.name);

  const groupIds = groups.map((g) => g.id);
  if (groupIds.length === 0) return NextResponse.json([]);

  const members = await db
    .select({
      groupId: clientGroupMembers.groupId,
      clientId: clientGroupMembers.clientId,
      clientName: clients.name,
      companyName: companies.name,
    })
    .from(clientGroupMembers)
    .innerJoin(clients, eq(clientGroupMembers.clientId, clients.id))
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(inArray(clientGroupMembers.groupId, groupIds));

  const membersByGroup = new Map<string, typeof members>();
  for (const m of members) {
    const list = membersByGroup.get(m.groupId) ?? [];
    list.push(m);
    membersByGroup.set(m.groupId, list);
  }

  const result = groups.map((g) => ({
    ...g,
    members: (membersByGroup.get(g.id) ?? []).map((m) => ({
      clientId: m.clientId,
      clientName: m.clientName,
      companyName: m.companyName,
    })),
  }));

  return NextResponse.json(result);
});

export const POST = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });

  const { name, description, clientIds } = body as {
    name?: string;
    description?: string;
    clientIds?: string[];
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Navn er påkrevd" }, { status: 400 });
  }
  if (!clientIds?.length || clientIds.length < 2) {
    return NextResponse.json({ error: "Minst 2 klienter er påkrevd" }, { status: 400 });
  }

  const validClients = await db
    .select({ id: clients.id })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(and(eq(companies.tenantId, tenantId), inArray(clients.id, clientIds)));

  if (validClients.length !== clientIds.length) {
    return NextResponse.json({ error: "En eller flere klienter ble ikke funnet" }, { status: 404 });
  }

  const [group] = await db
    .insert(clientGroups)
    .values({
      tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: userId,
    })
    .returning();

  await db.insert(clientGroupMembers).values(
    clientIds.map((cid) => ({ groupId: group.id, clientId: cid }))
  );

  await logAudit({ tenantId, userId, action: "group.created", entityType: "client_group", entityId: group.id, metadata: { name: group.name } });

  return NextResponse.json(group, { status: 201 });
});
