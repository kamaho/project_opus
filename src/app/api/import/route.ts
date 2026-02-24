import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imports, transactions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { parseFile, parseExcel, decodeTextBuffer } from "@/lib/parsers";
import type { CsvParserConfig, KlinkParserConfig, ExcelParserConfig } from "@/lib/parsers";
import { supabase, UPLOAD_BUCKET } from "@/lib/supabase";
import { z } from "zod";
import { logAuditTx } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { notifyImportCompleted } from "@/lib/notifications";
import * as Sentry from "@sentry/nextjs";

// ── Constants ──
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "application/xml",
  "text/xml",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // fallback for unknown types
]);
const INSERT_BATCH_SIZE = 500;

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeAmountForFingerprint(raw: string): string {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n.toFixed(2) : raw;
}

function txFingerprint(t: {
  date1: string;
  amount: string;
  description?: string | null;
  reference?: string | null;
  bilag?: string | null;
}): string {
  return [
    t.date1,
    normalizeAmountForFingerprint(t.amount),
    (t.description ?? "").toLowerCase().trim(),
    (t.reference ?? "").trim(),
    (t.bilag ?? "").trim(),
  ].join("|");
}

function sanitizeFilename(raw: string): string {
  const basename = raw.split(/[\\/]/).pop() ?? raw;
  return basename.replace(/^\.+/, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
}

const bodySchema = z.object({
  clientId: z.string().uuid(),
  setNumber: z.union([z.literal(1), z.literal(2)]),
  parserType: z.enum(["csv", "camt", "klink", "excel"]),
  csvConfig: z
    .object({
      delimiter: z.enum([";", ",", "\t"]),
      decimalSeparator: z.enum([".", ","]),
      hasHeader: z.boolean(),
      columns: z.record(z.string(), z.union([z.number(), z.string()])),
      dataStartRow: z.number().optional(),
    })
    .optional(),
  klinkSpec: z.string().optional(),
  excelConfig: z
    .object({
      dataStartRow: z.number(),
      columns: z.record(z.string(), z.number()),
      dateFormats: z.record(z.string(), z.string()).optional(),
      headerExtractions: z
        .array(z.object({ field: z.string(), label: z.string(), columnOffset: z.number().optional() }))
        .optional(),
      sheetIndex: z.number().optional(),
    })
    .optional(),
  dryRun: z.boolean().optional(),
  skipDuplicates: z.boolean().optional(),
  forceAll: z.boolean().optional(),
  selectedIndices: z.array(z.number()).optional(),
});

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limiting ──
  const rl = rateLimit(`import:${orgId}:${userId}`, RATE_LIMITS.import);
  if (!rl.success) {
    return NextResponse.json(
      { error: "For mange forespørsler", details: "Vent litt før du prøver igjen." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;
  const setNumberRaw = formData.get("setNumber");
  const parserType = formData.get("parserType") as string | null;
  const csvConfigRaw = formData.get("csvConfig");
  const klinkSpec = formData.get("klinkSpec") as string | null;
  const excelConfigRaw = formData.get("excelConfig") as string | null;
  const dryRunRaw = formData.get("dryRun");
  const skipDuplicatesRaw = formData.get("skipDuplicates");
  const forceAllRaw = formData.get("forceAll");
  const selectedIndicesRaw = formData.get("selectedIndices") as string | null;
  const dateFromRaw = formData.get("dateFrom") as string | null;
  const dateToRaw = formData.get("dateTo") as string | null;

  let parsedSelectedIndices: number[] | undefined;
  if (selectedIndicesRaw) {
    try { parsedSelectedIndices = JSON.parse(selectedIndicesRaw); } catch { /* ignore */ }
  }

  let csvConfigParsed: CsvParserConfig | undefined;
  let excelConfigParsed: ExcelParserConfig | undefined;
  try {
    if (typeof csvConfigRaw === "string" && csvConfigRaw) {
      csvConfigParsed = JSON.parse(csvConfigRaw) as CsvParserConfig;
    }
    if (typeof excelConfigRaw === "string" && excelConfigRaw) {
      excelConfigParsed = JSON.parse(excelConfigRaw) as ExcelParserConfig;
    }
  } catch {
    return NextResponse.json({ error: "Ugyldig konfigurasjonsformat" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse({
    clientId: clientId ?? undefined,
    setNumber: setNumberRaw === "1" ? 1 : setNumberRaw === "2" ? 2 : undefined,
    parserType: parserType ?? undefined,
    csvConfig: csvConfigParsed,
    klinkSpec: klinkSpec ?? undefined,
    excelConfig: excelConfigParsed,
    dryRun: dryRunRaw === "true",
    skipDuplicates: skipDuplicatesRaw === "true",
    forceAll: forceAllRaw === "true",
    selectedIndices: parsedSelectedIndices,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validering feilet",
        details: "Sjekk at fil, klient, mengde og filtype er angitt.",
      },
      { status: 400 }
    );
  }

  const {
    clientId: cId,
    setNumber: setNum,
    parserType: pType,
    csvConfig,
    klinkSpec: klinkSpecVal,
    excelConfig,
    dryRun,
    skipDuplicates,
    forceAll,
    selectedIndices,
  } = parsed.data;

  // ── File validation ──
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Ingen fil oppgitt" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Filen er for stor", details: `Maks filstørrelse er ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 400 }
    );
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Ugyldig filtype", details: `Filtypen "${file.type}" er ikke støttet. Last opp CSV, Excel, XML eller TXT.` },
      { status: 400 }
    );
  }

  // ── Tenant-scoped client validation ──
  const clientRow = await validateClientTenant(cId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  // ── File-level duplicate check (SHA-256) ──
  const fileBuffer = await file.arrayBuffer();
  const fileHash = await hashBuffer(fileBuffer);
  const fileSize = file.size;

  const [existingImport] = await db
    .select({ id: imports.id, filename: imports.filename })
    .from(imports)
    .where(
      and(
        eq(imports.fileHash, fileHash),
        eq(imports.clientId, cId),
        eq(imports.setNumber, setNum),
        sql`${imports.deletedAt} IS NULL`,
        sql`${imports.status} != 'duplicate'`
      )
    )
    .limit(1);

  const isExactFileDuplicate = !!existingImport && !forceAll && !skipDuplicates && !(selectedIndices && selectedIndices.length > 0);

  if (isExactFileDuplicate && !dryRun) {
    return NextResponse.json(
      {
        error: "Duplikat",
        details: `Denne filen er allerede importert som "${existingImport.filename}". Innholdet er 100% identisk.`,
        duplicateImportId: existingImport.id,
        isExactDuplicate: true,
      },
      { status: 409 }
    );
  }

  // ── Validate column mappings for Excel ──
  if (pType === "excel" && excelConfig) {
    const hasDate = excelConfig.columns.date1 !== undefined;
    const hasAmount = excelConfig.columns.amount !== undefined;
    const hasCreditDebit =
      excelConfig.columns.credit !== undefined &&
      excelConfig.columns.debit !== undefined;
    const missing: string[] = [];
    if (!hasDate) missing.push("Dato (date1)");
    if (!hasAmount && !hasCreditDebit) missing.push("Beløp (amount) eller Kredit + Debit");
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Manglende kolonnemapping",
          details: "Du må velge hvilken kolonne som er Dato og hvilken som er Beløp (eller Kredit + Debit).",
        },
        { status: 400 }
      );
    }
  }

  // ── Parse ──
  let parseResult: { transactions: import("@/lib/parsers").ParsedTransaction[]; errors: string[]; skippedRows?: import("@/lib/parsers").RowIssue[] };
  try {
    if (pType === "excel" && excelConfig) {
      parseResult = parseExcel(fileBuffer, excelConfig);
    } else {
      const content = decodeTextBuffer(fileBuffer);
      parseResult =
        pType === "csv" && csvConfig
          ? parseFile(content, "csv", csvConfig)
          : pType === "camt"
            ? parseFile(content, "camt")
            : pType === "klink" && klinkSpecVal
              ? parseFile(content, "klink", { spec: klinkSpecVal } as KlinkParserConfig)
              : { transactions: [], errors: ["Ukjent parser eller manglende konfigurasjon"] };
    }
  } catch {
    return NextResponse.json(
      { error: "Filen kunne ikke leses", details: "Filen er muligens skadet eller i et ukjent format." },
      { status: 400 }
    );
  }

  if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
    return NextResponse.json(
      {
        error: "Lesing av filen feilet",
        details: parseResult.errors.slice(0, 5).join(". "),
      },
      { status: 400 }
    );
  }

  // ── Server-side date validation ──
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const validTx = parseResult.transactions.filter((t) => {
    if (!t.date1 || !ISO_DATE_RE.test(t.date1)) return false;
    const y = +t.date1.slice(0, 4), m = +t.date1.slice(5, 7), d = +t.date1.slice(8, 10);
    return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  });
  const serverSkipped = parseResult.transactions.length - validTx.length;
  parseResult.transactions = validTx;

  if (dateFromRaw && dateToRaw) {
    parseResult.transactions = parseResult.transactions.filter(
      (t) => t.date1 >= dateFromRaw && t.date1 <= dateToRaw
    );
  }

  if (parseResult.transactions.length === 0) {
    return NextResponse.json(
      {
        error: "Ingen gyldige transaksjoner",
        details:
          "Alle rader ble filtrert bort pga. ugyldige dato- eller beløpsverdier. " +
          "Sjekk at filen inneholder gyldige datoer og beløp.",
        skippedCount: serverSkipped,
      },
      { status: 400 }
    );
  }

  // ── Transaction-level duplicate check ──
  const existingTx = await db
    .select({
      date1: transactions.date1,
      amount: transactions.amount,
      description: transactions.description,
      reference: transactions.reference,
      bilag: transactions.bilag,
    })
    .from(transactions)
    .leftJoin(imports, eq(transactions.importId, imports.id))
    .where(
      and(
        eq(transactions.clientId, cId),
        eq(transactions.setNumber, setNum),
        sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
      )
    );

  const existingFingerprints = new Set(
    existingTx.map((t) =>
      txFingerprint({
        date1: typeof t.date1 === "string" ? t.date1 : (t.date1 as Date)?.toISOString().slice(0, 10) ?? "",
        amount: t.amount ?? "0",
        description: t.description,
        reference: t.reference,
        bilag: t.bilag,
      })
    )
  );

  const newTx: typeof parseResult.transactions = [];
  const dupTx: Array<{ rowNumber: number; date1: string; amount: string; description?: string | null }> = [];

  for (let i = 0; i < parseResult.transactions.length; i++) {
    const t = parseResult.transactions[i];
    const fp = txFingerprint(t);
    if (existingFingerprints.has(fp)) {
      dupTx.push({ rowNumber: i + 1, date1: t.date1, amount: t.amount, description: t.description });
    } else {
      newTx.push(t);
    }
  }

  const hasDuplicates = dupTx.length > 0;

  // ── Dry-run: return duplicate report without inserting ──
  if (dryRun) {
    const newSum = newTx.reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0);
    return NextResponse.json({
      dryRun: true,
      isExactDuplicate: isExactFileDuplicate,
      totalCount: parseResult.transactions.length,
      duplicateCount: dupTx.length,
      newCount: newTx.length,
      newSum,
      skippedCount: serverSkipped,
      duplicates: dupTx.slice(0, 50),
    });
  }

  // Determine which transactions to insert
  let txToInsert: typeof parseResult.transactions;
  if (selectedIndices && selectedIndices.length > 0) {
    const indexSet = new Set(selectedIndices);
    txToInsert = parseResult.transactions.filter((_, i) => indexSet.has(i));
  } else if (forceAll) {
    txToInsert = parseResult.transactions;
  } else if (skipDuplicates || hasDuplicates) {
    txToInsert = newTx;
  } else {
    txToInsert = parseResult.transactions;
  }

  if (txToInsert.length === 0 && hasDuplicates) {
    return NextResponse.json(
      {
        error: "Kun duplikater",
        details: `Alle ${dupTx.length} transaksjoner finnes allerede. Ingen nye rader å importere.`,
        duplicateCount: dupTx.length,
        newCount: 0,
      },
      { status: 409 }
    );
  }

  // ── Upload file to storage ──
  const filename = sanitizeFilename(file.name);
  let storagePath = `${orgId}/${cId}/${setNum}/${Date.now()}-${filename}`;
  let storageError: string | null = null;

  if (supabase) {
    const { error: uploadError } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .upload(storagePath, new Blob([fileBuffer]), {
        contentType: file.type || "application/octet-stream",
      });
    if (uploadError) {
      storageError = uploadError.message;
      storagePath = "";
    }
  }

  // ── Atomic insert: import + transactions + audit in one transaction ──
  try {
    const result = await db.transaction(async (tx) => {
      const [importRow] = await tx
        .insert(imports)
        .values({
          clientId: cId,
          setNumber: setNum,
          filename: file.name,
          filePath: storagePath,
          fileHash: fileHash,
          fileSize: fileSize,
          recordCount: txToInsert.length,
          status: "completed",
          importedBy: userId,
          errorMessage: storageError,
        })
        .returning({ id: imports.id });

      if (!importRow) {
        throw new Error("Failed to create import record");
      }

      // Batch insert transactions in chunks
      if (txToInsert.length > 0) {
        for (let i = 0; i < txToInsert.length; i += INSERT_BATCH_SIZE) {
          const chunk = txToInsert.slice(i, i + INSERT_BATCH_SIZE);
          const txValues = chunk.map((t) => ({
            clientId: cId,
            setNumber: setNum,
            importId: importRow.id,
            amount: t.amount,
            date1: t.date1,
            accountNumber: t.accountNumber ?? null,
            currency: t.currency ?? "NOK",
            foreignAmount: t.foreignAmount ?? null,
            reference: t.reference ?? null,
            description: t.description ?? null,
            textCode: t.textCode ?? null,
            dim1: t.dim1 ?? null,
            dim2: t.dim2 ?? null,
            dim3: t.dim3 ?? null,
            dim4: t.dim4 ?? null,
            dim5: t.dim5 ?? null,
            dim6: t.dim6 ?? null,
            dim7: t.dim7 ?? null,
            dim8: t.dim8 ?? null,
            dim9: t.dim9 ?? null,
            dim10: t.dim10 ?? null,
            sign: t.sign ?? null,
            date2: t.date2 ?? null,
            buntref: t.buntref ?? null,
            notat: t.notat ?? null,
            bilag: t.bilag ?? null,
            faktura: t.faktura ?? null,
            forfall: t.forfall ?? null,
            periode: t.periode ?? null,
            importNumber: t.importNumber ?? null,
            avgift: t.avgift ?? null,
            tilleggstekst: t.tilleggstekst ?? null,
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
          await tx.insert(transactions).values(txValues);
        }
      }

      // Audit log
      await logAuditTx(tx, {
        tenantId: orgId,
        userId,
        action: "import.created",
        entityType: "import",
        entityId: importRow.id,
        metadata: {
          filename: file.name,
          setNumber: setNum,
          recordCount: txToInsert.length,
          duplicatesSkipped: hasDuplicates ? dupTx.length : 0,
          serverSkipped,
        },
      });

      return importRow;
    });

    notifyImportCompleted({
      tenantId: orgId,
      userId,
      clientId: cId,
      clientName: clientRow.name,
      filename: file.name,
      recordCount: txToInsert.length,
      setNumber: setNum,
    }).catch((e) => console.error("[import] notification failed:", e));

    return NextResponse.json({
      importId: result.id,
      recordCount: txToInsert.length,
      totalParsed: parseResult.transactions.length,
      duplicateCount: dupTx.length,
      duplicatesSkipped: hasDuplicates && !forceAll,
      errors: parseResult.errors,
      ...(serverSkipped > 0
        ? { skippedCount: serverSkipped, skippedInfo: `${serverSkipped} rad(er) med ugyldige verdier ble hoppet over.` }
        : {}),
      ...(storageError ? { warning: "Filen ble ikke lagret i cloud, men transaksjonene er importert." } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const isDateError = message.includes("date/time field value out of range");
    const isNumericError = message.includes("invalid input syntax for type numeric");
    let details = "En uventet feil oppstod. Prøv igjen eller kontakt support.";
    if (isDateError) {
      details =
        "En eller flere rader inneholder ugyldige datoverdier. " +
        "Sjekk at alle datoer i filen har et gyldig format (f.eks. ÅÅÅÅ-MM-DD, DD.MM.ÅÅÅÅ).";
    } else if (isNumericError) {
      details =
        "En eller flere rader inneholder ugyldige beløpsverdier. " +
        "Sjekk at beløpskolonnen kun inneholder tall.";
    }

    Sentry.captureException(err, { extra: { tenantId: orgId, clientId: cId } });
    console.error("[import] Failed", { tenantId: orgId, clientId: cId, error: message });

    return NextResponse.json(
      { error: "Import feilet", details },
      { status: 500 }
    );
  }
}
