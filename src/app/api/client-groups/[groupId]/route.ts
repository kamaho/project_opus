import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientGroups, clientGroupMembers, clients, companies } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;

  const [group] = await db
    .select({ id: clientGroups.id })
    .from(clientGroups)
    .where(and(eq(clientGroups.id, groupId), eq(clientGroups.tenantId, orgId)));

  if (!group) return NextResponse.json({ error: "Gruppe ikke funnet" }, { status: 404 });

  await db.delete(clientGroups).where(eq(clientGroups.id, groupId));

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;

  const [group] = await db
    .select({ id: clientGroups.id })
    .from(clientGroups)
    .where(and(eq(clientGroups.id, groupId), eq(clientGroups.tenantId, orgId)));

  if (!group) return NextResponse.json({ error: "Gruppe ikke funnet" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });

  const { name, description, color, icon, clientIds, assignedUserId } = body as {
    name?: string;
    description?: string;
    color?: string | null;
    icon?: string | null;
    clientIds?: string[];
    assignedUserId?: string | null;
  };

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
      .where(and(eq(companies.tenantId, orgId), inArray(clients.id, clientIds)));

    if (validClients.length !== clientIds.length) {
      return NextResponse.json({ error: "En eller flere klienter ble ikke funnet" }, { status: 404 });
    }

    await db.delete(clientGroupMembers).where(eq(clientGroupMembers.groupId, groupId));
    await db.insert(clientGroupMembers).values(
      clientIds.map((cid) => ({ groupId, clientId: cid }))
    );
  }

  return NextResponse.json({ ok: true });
}
