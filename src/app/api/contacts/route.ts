import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  role: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.tenantId, orgId));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(contacts)
    .values({
      tenantId: orgId,
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      role: parsed.data.role?.trim() || null,
      company: parsed.data.company?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...fields } = body as { id?: string } & Record<string, unknown>;
  if (!id) {
    return NextResponse.json({ error: "Mangler id" }, { status: 400 });
  }

  const parsed = createContactSchema.partial().safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.email !== undefined) updates.email = parsed.data.email.trim().toLowerCase();
  if (parsed.data.role !== undefined) updates.role = parsed.data.role?.trim() || null;
  if (parsed.data.company !== undefined) updates.company = parsed.data.company?.trim() || null;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone?.trim() || null;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Ingen felter å oppdatere" }, { status: 400 });
  }

  const [updated] = await db
    .update(contacts)
    .set(updates)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, orgId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Kontakt ikke funnet" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Mangler id" }, { status: 400 });
  }

  const deleted = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, orgId)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json(
      { error: "Kontakt ikke funnet" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
