import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  documentRequests,
  documentRequestFiles,
  contacts,
  tasks,
  transactionAttachments,
  transactions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

type RouteParams = { params: Promise<{ token: string }> };

async function getValidRequest(token: string) {
  const [row] = await db
    .select({
      id: documentRequests.id,
      tenantId: documentRequests.tenantId,
      token: documentRequests.token,
      taskId: documentRequests.taskId,
      clientId: documentRequests.clientId,
      transactionId: documentRequests.transactionId,
      contactId: documentRequests.contactId,
      createdBy: documentRequests.createdBy,
      message: documentRequests.message,
      status: documentRequests.status,
      expiresAt: documentRequests.expiresAt,
      contactName: contacts.name,
      contactEmail: contacts.email,
      taskTitle: tasks.title,
    })
    .from(documentRequests)
    .leftJoin(contacts, eq(documentRequests.contactId, contacts.id))
    .leftJoin(tasks, eq(documentRequests.taskId, tasks.id))
    .where(eq(documentRequests.token, token));

  return row ?? null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const row = await getValidRequest(token);

  if (!row) {
    return NextResponse.json(
      { error: "Forespørsel ikke funnet" },
      { status: 404 }
    );
  }

  if (row.status === "completed") {
    return NextResponse.json({
      status: "completed",
      contactName: row.contactName,
      message: row.message,
    });
  }

  if (row.status === "cancelled") {
    return NextResponse.json(
      { error: "Denne forespørselen er kansellert" },
      { status: 410 }
    );
  }

  if (new Date(row.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Denne lenken har utløpt" },
      { status: 410 }
    );
  }

  return NextResponse.json({
    status: "pending",
    contactName: row.contactName,
    message: row.message,
    taskTitle: row.taskTitle,
    expiresAt: row.expiresAt,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const row = await getValidRequest(token);

  if (!row) {
    return NextResponse.json(
      { error: "Forespørsel ikke funnet" },
      { status: 404 }
    );
  }

  if (row.status !== "pending") {
    return NextResponse.json(
      { error: "Denne forespørselen er allerede behandlet" },
      { status: 400 }
    );
  }

  if (new Date(row.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Denne lenken har utløpt" },
      { status: 410 }
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Fillagring ikke konfigurert" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Ingen filer mottatt" },
      { status: 400 }
    );
  }

  const uploaded: { filename: string; fileSize: number }[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${row.tenantId}/document-requests/${row.id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, new Blob([buffer]), {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      console.error("[document-request-upload] Upload failed:", uploadError);
      continue;
    }

    await db.insert(documentRequestFiles).values({
      requestId: row.id,
      filename: file.name,
      filePath: storagePath,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
    });

    if (row.transactionId && row.clientId) {
      const [txExists] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.id, row.transactionId),
            eq(transactions.clientId, row.clientId)
          )
        );

      if (txExists) {
        await db.insert(transactionAttachments).values({
          transactionId: row.transactionId,
          clientId: row.clientId,
          filename: file.name,
          filePath: storagePath,
          fileSize: file.size,
          contentType: file.type || "application/octet-stream",
          uploadedBy: `external:${row.contactId}`,
        });
      }
    }

    uploaded.push({ filename: file.name, fileSize: file.size });
  }

  if (uploaded.length > 0) {
    await db
      .update(documentRequests)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(documentRequests.id, row.id));

    const fileList = uploaded.map((f) => f.filename).join(", ");
    await createNotification({
      tenantId: row.tenantId,
      userId: row.createdBy,
      type: "system",
      title: "Dokumentasjon mottatt",
      body: `${row.contactName ?? "Ekstern kontakt"} har lastet opp: ${fileList}`,
      link: row.clientId
        ? `/dashboard/clients/${row.clientId}/matching`
        : "/dashboard/oppgaver",
      entityType: "document_request",
      entityId: row.id,
    });

    if (row.taskId) {
      await db
        .update(tasks)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(tasks.id, row.taskId));
    }
  }

  return NextResponse.json({
    ok: true,
    filesUploaded: uploaded.length,
    files: uploaded,
  });
}
