import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  documentRequests,
  documentRequestFiles,
  contacts,
  tasks,
  clients,
} from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendDocumentRequestEmail } from "@/lib/resend";
import { clerkClient } from "@clerk/nextjs/server";

const createSchema = z.object({
  contactId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  message: z.string().max(2000).optional(),
  metadata: z.any().optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const GET = withTenant(async (_req, { tenantId }) => {
  const rows = await db
    .select({
      id: documentRequests.id,
      token: documentRequests.token,
      taskId: documentRequests.taskId,
      clientId: documentRequests.clientId,
      transactionId: documentRequests.transactionId,
      contactId: documentRequests.contactId,
      message: documentRequests.message,
      status: documentRequests.status,
      expiresAt: documentRequests.expiresAt,
      completedAt: documentRequests.completedAt,
      createdBy: documentRequests.createdBy,
      createdAt: documentRequests.createdAt,
      contactName: contacts.name,
      contactEmail: contacts.email,
      clientName: clients.name,
      taskTitle: tasks.title,
      fileCount: count(documentRequestFiles.id),
    })
    .from(documentRequests)
    .leftJoin(contacts, eq(documentRequests.contactId, contacts.id))
    .leftJoin(clients, eq(documentRequests.clientId, clients.id))
    .leftJoin(tasks, eq(documentRequests.taskId, tasks.id))
    .leftJoin(
      documentRequestFiles,
      eq(documentRequests.id, documentRequestFiles.requestId)
    )
    .where(eq(documentRequests.tenantId, tenantId))
    .groupBy(
      documentRequests.id,
      contacts.name,
      contacts.email,
      clients.name,
      tasks.title
    )
    .orderBy(desc(documentRequests.createdAt))
    .limit(200);

  return NextResponse.json(rows);
});

export const POST = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const [contact] = await db
    .select({ id: contacts.id, name: contacts.name, email: contacts.email })
    .from(contacts)
    .where(and(eq(contacts.id, data.contactId), eq(contacts.tenantId, tenantId)));

  if (!contact) {
    return NextResponse.json(
      { error: "Kontakt ikke funnet" },
      { status: 404 }
    );
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);

  let created;
  try {
    [created] = await db
      .insert(documentRequests)
      .values({
        tenantId,
        token,
        taskId: data.taskId ?? null,
        clientId: data.clientId ?? null,
        transactionId: data.transactionId ?? null,
        contactId: data.contactId,
        createdBy: userId,
        message: data.message ?? null,
        metadata: data.metadata ?? {},
        status: "pending",
        expiresAt,
      })
      .returning();
  } catch (dbErr) {
    console.error("[document-requests] DB insert failed:", dbErr);
    return NextResponse.json(
      { error: "Kunne ikke opprette forespørsel" },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.revizo.no";
  const uploadUrl = `${appUrl}/d/${token}`;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const senderName = user.fullName ?? user.firstName ?? "Revizo";

    let orgName: string | undefined;
    try {
      const org = await clerk.organizations.getOrganization({
        organizationId: tenantId,
      });
      orgName = org.name;
    } catch {
      /* ignore */
    }

    await sendDocumentRequestEmail({
      to: contact.email,
      contactName: contact.name,
      requestMessage: data.message,
      senderName,
      orgName,
      uploadUrl,
      expiresAt,
    });
  } catch (err) {
    console.error("[document-requests] Failed to send email:", err);
  }

  return NextResponse.json({ ...created, uploadUrl }, { status: 201 });
});
