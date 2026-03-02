import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactionAttachments, transactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";
import { validateUploadedFile, sanitizeFilename } from "@/lib/upload-validation";

export const GET = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;
  const transactionId = params!.transactionId;

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
});

export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;
  const transactionId = params!.transactionId;

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

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "Ingen filer mottatt" }, { status: 400 });
  }

  for (const file of files) {
    const validation = validateUploadedFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  const results = [];

  for (const file of files) {
    const safeName = sanitizeFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${tenantId}/${clientId}/${transactionId}/${Date.now()}-${safeName}`;

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
        filename: safeName,
        filePath: storagePath,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
        uploadedBy: userId,
      })
      .returning();

    results.push(inserted);
  }

  return NextResponse.json({ ok: true, attachments: results });
});
