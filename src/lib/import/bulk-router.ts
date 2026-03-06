/**
 * Bulk file routing: detect account numbers in files and map them to clients/sets.
 */

import { db } from "@/lib/db";
import { accounts, clients, companies, imports } from "@/lib/db/schema";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { peekAccountNumber, type PeekResult } from "@/lib/parsers/peek-account";
import { ibanToBBAN, isIBAN, validateMod11 } from "@/lib/onboarding/iban";

export type FileRoutingStatus =
  | "matched"
  | "no_account"
  | "no_client"
  | "ambiguous"
  | "duplicate";

export interface FileRouting {
  fileRef: string;
  fileName: string;
  detectedAccount: string | null;
  detectedSource: PeekResult["source"];
  clientId: string | null;
  clientName: string | null;
  companyName: string | null;
  setNumber: 1 | 2 | null;
  status: FileRoutingStatus;
  duplicateInfo?: {
    importedAt: string;
    clientName: string;
  };
}

interface FileInput {
  fileRef: string;
  fileName: string;
  content: string;
  fileType: "csv" | "camt" | "klink" | "excel";
  rawRows?: string[][];
  fileHash?: string;
}

/**
 * Match files to clients by peeking at account numbers in each file.
 * Scoped to a single tenant for security.
 */
export async function matchFilesToClients(
  files: FileInput[],
  tenantId: string
): Promise<FileRouting[]> {
  const tenantAccounts = await db
    .select({
      accountId: accounts.id,
      accountNumber: accounts.accountNumber,
      companyId: accounts.companyId,
    })
    .from(accounts)
    .innerJoin(companies, eq(accounts.companyId, companies.id))
    .where(eq(companies.tenantId, tenantId));

  const tenantClients = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      companyId: clients.companyId,
      set1AccountId: clients.set1AccountId,
      set2AccountId: clients.set2AccountId,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(eq(companies.tenantId, tenantId));

  const tenantCompanies = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.tenantId, tenantId));

  const companyMap = new Map(tenantCompanies.map((c) => [c.id, c.name]));

  const accountsByNumber = new Map<string, typeof tenantAccounts[number][]>();
  for (const acc of tenantAccounts) {
    const normalized = normalizeAccountKey(acc.accountNumber);
    const existing = accountsByNumber.get(normalized) ?? [];
    existing.push(acc);
    accountsByNumber.set(normalized, existing);
  }

  const clientsByAccountId = new Map<string, { clientId: string; clientName: string; companyId: string; setNumber: 1 | 2 }[]>();
  for (const cl of tenantClients) {
    for (const [setNum, accId] of [[1, cl.set1AccountId], [2, cl.set2AccountId]] as const) {
      if (!accId) continue;
      const existing = clientsByAccountId.get(accId) ?? [];
      existing.push({ clientId: cl.clientId, clientName: cl.clientName, companyId: cl.companyId, setNumber: setNum });
      clientsByAccountId.set(accId, existing);
    }
  }

  const fileHashes = files.map((f) => f.fileHash).filter(Boolean) as string[];
  const existingImports = fileHashes.length > 0
    ? await db
        .select({
          fileHash: imports.fileHash,
          clientId: imports.clientId,
          createdAt: imports.createdAt,
        })
        .from(imports)
        .where(
          and(
            inArray(imports.fileHash, fileHashes),
            isNull(imports.deletedAt)
          )
        )
    : [];

  const importsByHash = new Map<string, { clientId: string; createdAt: Date | null }>();
  for (const imp of existingImports) {
    if (imp.fileHash) importsByHash.set(imp.fileHash, { clientId: imp.clientId, createdAt: imp.createdAt });
  }

  const results: FileRouting[] = [];

  for (const file of files) {
    if (file.fileHash && importsByHash.has(file.fileHash)) {
      const dupInfo = importsByHash.get(file.fileHash)!;
      const dupClient = tenantClients.find((c) => c.clientId === dupInfo.clientId);
      results.push({
        fileRef: file.fileRef,
        fileName: file.fileName,
        detectedAccount: null,
        detectedSource: null,
        clientId: null,
        clientName: null,
        companyName: null,
        setNumber: null,
        status: "duplicate",
        duplicateInfo: {
          importedAt: dupInfo.createdAt?.toISOString() ?? "ukjent",
          clientName: dupClient?.clientName ?? "ukjent",
        },
      });
      continue;
    }

    const peek = peekAccountNumber(file.content, file.fileType, file.fileName, file.rawRows);

    if (!peek.accountNumber) {
      results.push({
        fileRef: file.fileRef,
        fileName: file.fileName,
        detectedAccount: null,
        detectedSource: peek.source,
        clientId: null,
        clientName: null,
        companyName: null,
        setNumber: null,
        status: "no_account",
      });
      continue;
    }

    const normalized = normalizeAccountKey(peek.accountNumber);
    const matchingAccounts = accountsByNumber.get(normalized) ?? [];

    if (matchingAccounts.length === 0) {
      results.push({
        fileRef: file.fileRef,
        fileName: file.fileName,
        detectedAccount: peek.accountNumber,
        detectedSource: peek.source,
        clientId: null,
        clientName: null,
        companyName: null,
        setNumber: null,
        status: "no_client",
      });
      continue;
    }

    const allClientMatches: { clientId: string; clientName: string; companyId: string; setNumber: 1 | 2 }[] = [];
    for (const acc of matchingAccounts) {
      const clientsForAcc = clientsByAccountId.get(acc.accountId) ?? [];
      allClientMatches.push(...clientsForAcc);
    }

    if (allClientMatches.length === 0) {
      results.push({
        fileRef: file.fileRef,
        fileName: file.fileName,
        detectedAccount: peek.accountNumber,
        detectedSource: peek.source,
        clientId: null,
        clientName: null,
        companyName: null,
        setNumber: null,
        status: "no_client",
      });
      continue;
    }

    if (allClientMatches.length === 1) {
      const match = allClientMatches[0];
      results.push({
        fileRef: file.fileRef,
        fileName: file.fileName,
        detectedAccount: peek.accountNumber,
        detectedSource: peek.source,
        clientId: match.clientId,
        clientName: match.clientName,
        companyName: companyMap.get(match.companyId) ?? null,
        setNumber: match.setNumber,
        status: "matched",
      });
      continue;
    }

    const unique = new Map(allClientMatches.map((m) => [`${m.clientId}-${m.setNumber}`, m]));
    if (unique.size === 1) {
      const match = [...unique.values()][0];
      results.push({
        fileRef: file.fileRef,
        fileName: file.fileName,
        detectedAccount: peek.accountNumber,
        detectedSource: peek.source,
        clientId: match.clientId,
        clientName: match.clientName,
        companyName: companyMap.get(match.companyId) ?? null,
        setNumber: match.setNumber,
        status: "matched",
      });
    } else {
      results.push({
        fileRef: file.fileRef,
        fileName: file.fileName,
        detectedAccount: peek.accountNumber,
        detectedSource: peek.source,
        clientId: null,
        clientName: null,
        companyName: null,
        setNumber: null,
        status: "ambiguous",
      });
    }
  }

  return results;
}

/** Normalize an account number to a canonical BBAN (11 digits) for lookup. */
function normalizeAccountKey(raw: string): string {
  const cleaned = raw.replace(/[\s.]/g, "");
  if (isIBAN(cleaned)) return ibanToBBAN(cleaned);
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 11) return digits;
  return cleaned;
}
