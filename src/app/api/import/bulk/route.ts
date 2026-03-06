import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db } from "@/lib/db";
import {
  imports,
  transactions,
  clients,
  companies,
  accounts,
  bulkJobs,
} from "@/lib/db/schema";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";
import { supabase, UPLOAD_BUCKET } from "@/lib/supabase";
import { peekAccountNumber } from "@/lib/parsers/peek-account";
import {
  matchFilesToClients,
  type FileRouting,
} from "@/lib/import/bulk-router";
import { parseFile, parseExcel, decodeTextBuffer } from "@/lib/parsers";
import type {
  CsvParserConfig,
  ExcelParserConfig,
  ParsedTransaction,
} from "@/lib/parsers";
import { computeSignature, headerSet } from "@/lib/parsers/header-signature";
import { refreshClientStats } from "@/lib/db/refresh-stats";

export const maxDuration = 120;

const STAGING_PREFIX = "imports-staging";
const INSERT_BATCH_SIZE = 500;

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function detectFileType(name: string): "csv" | "camt" | "klink" | "excel" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xml") || lower.endsWith(".camt")) return "camt";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
  return "csv";
}

/**
 * POST /api/import/bulk
 *
 * Two modes:
 * - mode=stage: Upload files, peek accounts, return routing preview
 * - mode=commit: Import staged files using provided routing and configs
 */
export const POST = withTenant(async (req: NextRequest, ctx) => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return handleCommit(req, ctx.tenantId, ctx.userId);
  }

  return handleStage(req, ctx.tenantId);
});

async function handleStage(req: NextRequest, tenantId: string) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "Ingen filer valgt" }, { status: 400 });
  }

  if (files.length > 50) {
    return NextResponse.json({ error: "Maks 50 filer per batch" }, { status: 400 });
  }

  const fileInputs: {
    fileRef: string;
    fileName: string;
    content: string;
    fileType: "csv" | "camt" | "klink" | "excel";
    rawRows?: string[][];
    fileHash: string;
    headers?: string[];
  }[] = [];

  const signatureGroups = new Map<string, { signature: string; headers: string[]; fileRefs: string[] }>();

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const hash = await hashBuffer(buffer);
    const fileType = detectFileType(file.name);
    const fileRef = `${STAGING_PREFIX}/${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;

    if (supabase) {
      const { error } = await supabase.storage
        .from(UPLOAD_BUCKET)
        .upload(fileRef, buffer, { contentType: file.type || "application/octet-stream" });
      if (error) {
        return NextResponse.json({ error: `Kunne ikke laste opp ${file.name}: ${error.message}` }, { status: 500 });
      }
    }

    let content = "";
    let rawRows: string[][] | undefined;
    let headers: string[] | undefined;

    if (fileType === "excel") {
      const xlsx = await import("xlsx");
      const workbook = xlsx.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (sheet) {
        const jsonRows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        rawRows = jsonRows.map((r) => (Array.isArray(r) ? r.map(String) : []));
        headers = rawRows[0];
        content = rawRows.map((r) => r.join(";")).join("\n");
      }
    } else {
      content = decodeTextBuffer(buffer);
      if (fileType === "csv") {
        const lines = content.split(/\r?\n/).filter((l) => l.trim());
        const firstLine = lines[0] ?? "";
        const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
        for (const ch of firstLine) if (ch in counts) counts[ch]++;
        const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ";";
        rawRows = lines.map((l) => l.split(delim));
        headers = rawRows[0];
      }
    }

    if (headers && (fileType === "csv" || fileType === "excel")) {
      const sig = await computeSignature(headers);
      const hSet = headerSet(headers);
      const existing = signatureGroups.get(sig);
      if (existing) {
        existing.fileRefs.push(fileRef);
      } else {
        signatureGroups.set(sig, { signature: sig, headers, fileRefs: [fileRef] });
      }
    }

    fileInputs.push({
      fileRef,
      fileName: file.name,
      content,
      fileType,
      rawRows,
      fileHash: hash,
      headers,
    });
  }

  const routing = await matchFilesToClients(fileInputs, tenantId);

  const signatures = Array.from(signatureGroups.values()).map((sg) => ({
    signature: sg.signature,
    headers: sg.headers,
    fileRefs: sg.fileRefs,
    fileCount: sg.fileRefs.length,
  }));

  return NextResponse.json({
    files: routing,
    signatures,
  });
}

const commitSchema = z.object({
  fileImports: z.array(
    z.object({
      fileRef: z.string(),
      fileName: z.string(),
      clientId: z.string().uuid(),
      setNumber: z.union([z.literal(1), z.literal(2)]),
      parserType: z.enum(["csv", "camt", "klink", "excel"]),
      csvConfig: z
        .object({
          delimiter: z.enum([";", ",", "\t"]),
          decimalSeparator: z.enum([".", ","]),
          hasHeader: z.boolean(),
          columns: z.record(z.string(), z.number()),
          dataStartRow: z.number().optional(),
        })
        .optional(),
      excelConfig: z
        .object({
          dataStartRow: z.number(),
          columns: z.record(z.string(), z.number()),
          dateFormats: z.record(z.string(), z.string()).optional(),
        })
        .optional(),
      force: z.boolean().optional(),
    })
  ),
});

async function handleCommit(req: NextRequest, tenantId: string, userId: string) {
  const body = await req.json().catch(() => ({}));
  const parsed = commitSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { fileImports } = parsed.data;

  const clientIds = [...new Set(fileImports.map((f) => f.clientId))];
  const ownedClients = await db
    .select({ id: clients.id })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(and(eq(companies.tenantId, tenantId), inArray(clients.id, clientIds)));

  const ownedSet = new Set(ownedClients.map((c) => c.id));
  const unauthorized = clientIds.filter((id) => !ownedSet.has(id));
  if (unauthorized.length > 0) {
    return NextResponse.json(
      { error: "En eller flere klienter tilhører ikke din organisasjon." },
      { status: 403 }
    );
  }

  const [job] = await db
    .insert(bulkJobs)
    .values({
      tenantId,
      type: "import",
      status: "running",
      total: fileImports.length,
      completed: 0,
      results: [],
      createdBy: userId,
    })
    .returning();

  processImportsInBackground(job.id, fileImports, tenantId, userId);

  return NextResponse.json({ jobId: job.id, total: fileImports.length });
}

async function processImportsInBackground(
  jobId: string,
  fileImports: z.infer<typeof commitSchema>["fileImports"],
  tenantId: string,
  userId: string
) {
  const results: { fileName: string; clientId: string; status: string; imported?: number; error?: string }[] = [];

  for (const fi of fileImports) {
    try {
      let buffer: ArrayBuffer | null = null;
      let content = "";

      if (supabase) {
        const { data, error } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .download(fi.fileRef);
        if (error || !data) {
          results.push({ fileName: fi.fileName, clientId: fi.clientId, status: "error", error: "Kunne ikke lese fil fra staging" });
          await updateJobProgress(jobId, results);
          continue;
        }
        buffer = await data.arrayBuffer();
        content = decodeTextBuffer(buffer);
      }

      let txs: ParsedTransaction[] = [];
      let errors: string[] = [];

      if (fi.parserType === "camt") {
        const result = parseFile(content, "camt");
        txs = result.transactions;
        errors = result.errors;
      } else if (fi.parserType === "csv" && fi.csvConfig) {
        const cfg: CsvParserConfig = {
          delimiter: fi.csvConfig.delimiter,
          decimalSeparator: fi.csvConfig.decimalSeparator,
          hasHeader: fi.csvConfig.hasHeader,
          columns: fi.csvConfig.columns,
          dataStartRow: fi.csvConfig.dataStartRow,
        };
        const result = parseFile(content, "csv", cfg);
        txs = result.transactions;
        errors = result.errors;
      } else if (fi.parserType === "excel" && fi.excelConfig && buffer) {
        const cfg: ExcelParserConfig = {
          dataStartRow: fi.excelConfig.dataStartRow,
          columns: fi.excelConfig.columns,
          dateFormats: fi.excelConfig.dateFormats ?? {},
        };
        const result = parseExcel(buffer, cfg);
        txs = result.transactions;
        errors = result.errors;
      }

      if (txs.length === 0) {
        results.push({
          fileName: fi.fileName,
          clientId: fi.clientId,
          status: "error",
          error: errors.length > 0 ? errors[0] : "Ingen transaksjoner funnet",
        });
        await updateJobProgress(jobId, results);
        continue;
      }

      const storagePath = fi.fileRef;
      const [importRecord] = await db
        .insert(imports)
        .values({
          clientId: fi.clientId,
          setNumber: fi.setNumber,
          filename: fi.fileName,
          filePath: storagePath,
          recordCount: txs.length,
          status: "completed",
          importedBy: userId,
        })
        .returning();

      const rows = txs.map((t) => ({
        clientId: fi.clientId,
        setNumber: fi.setNumber,
        importId: importRecord.id,
        accountNumber: t.accountNumber ?? null,
        amount: t.amount,
        foreignAmount: t.foreignAmount ?? null,
        currency: t.currency ?? "NOK",
        date1: t.date1,
        date2: t.date2 ?? null,
        reference: t.reference ?? null,
        description: t.description ?? null,
        textCode: t.textCode ?? null,
        dim1: t.dim1 ?? null,
        dim2: t.dim2 ?? null,
        dim3: t.dim3 ?? null,
        dim4: t.dim4 ?? null,
        dim5: t.dim5 ?? null,
        dim6: t.dim6 ?? null,
        sign: t.sign ?? null,
        bilag: t.bilag ?? null,
        faktura: t.faktura ?? null,
        forfall: t.forfall ?? null,
        periode: t.periode ?? null,
        importNumber: t.importNumber ?? null,
        buntref: t.buntref ?? null,
        tilleggstekst: t.tilleggstekst ?? null,
        avgift: t.avgift ?? null,
        ref2: t.ref2 ?? null,
        ref3: t.ref3 ?? null,
        ref4: t.ref4 ?? null,
        ref5: t.ref5 ?? null,
        ref6: t.ref6 ?? null,
        anleggsnr: t.anleggsnr ?? null,
        anleggsbeskrivelse: t.anleggsbeskrivelse ?? null,
        bilagsart: t.bilagsart ?? null,
        avsnr: t.avsnr ?? null,
        tid: t.tid ?? null,
        avvikendeDato: t.avvikendeDato ?? null,
        rate: t.rate ?? null,
        kundenavn: t.kundenavn ?? null,
        kontonummerBokforing: t.kontonummerBokføring ?? null,
      }));

      for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        await db.insert(transactions).values(rows.slice(i, i + INSERT_BATCH_SIZE));
      }

      await refreshClientStats().catch(() => {});

      results.push({
        fileName: fi.fileName,
        clientId: fi.clientId,
        status: "completed",
        imported: txs.length,
      });
    } catch (err) {
      results.push({
        fileName: fi.fileName,
        clientId: fi.clientId,
        status: "error",
        error: err instanceof Error ? err.message : "Ukjent feil",
      });
    }

    await updateJobProgress(jobId, results);
  }

  await db
    .update(bulkJobs)
    .set({
      status: results.some((r) => r.status === "error") ? "failed" : "completed",
      completed: results.length,
      results,
      updatedAt: new Date(),
    })
    .where(eq(bulkJobs.id, jobId));
}

async function updateJobProgress(
  jobId: string,
  results: unknown[]
) {
  await db
    .update(bulkJobs)
    .set({
      completed: results.length,
      results,
      updatedAt: new Date(),
    })
    .where(eq(bulkJobs.id, jobId));
}
