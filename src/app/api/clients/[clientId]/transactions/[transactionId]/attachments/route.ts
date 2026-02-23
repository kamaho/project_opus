import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactionAttachments, transactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";

type RouteParams = { params: Promise<{ clientId: string; transactionId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, transactionId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  const attachments = await db
    .select()
    .from(transactionAttachments)
    .where(
      and(
        eq(transactionAttachments.transactionId, transactionId),
        eq(transactionAttachments.clientId, clientId)
      )
    )
    .orderBy(transactionAttachments.createdAt);

  return NextResponse.json(attachments);
}

export async function POST(request: Request, { params }: RouteParams) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, transactionId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Storage ikke konfigurert" }, { status: 500 });
  }

  const [txRow] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.clientId, clientId)));

  if (!txRow) {
    return NextResponse.json({ error: "Transaksjon ikke funnet" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "Ingen filer mottatt" }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${orgId}/${clientId}/${transactionId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, new Blob([buffer]), {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      console.error("[attachments] Upload failed:", uploadError);
      continue;
    }

    const [inserted] = await db
      .insert(transactionAttachments)
      .values({
        transactionId,
        clientId,
        filename: file.name,
        filePath: storagePath,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
        uploadedBy: userId,
      })
      .returning();

    results.push(inserted);
  }

  return NextResponse.json({ ok: true, attachments: results });
}
