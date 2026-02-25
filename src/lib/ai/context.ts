import { db } from "@/lib/db";
import {
  clients,
  companies,
  transactions,
  matches,
  userOnboarding,
  aiUserMemory,
} from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import type { UserContext, PageContext } from "./types";

export async function getUserContext(
  userId: string,
  orgId: string,
  userName?: string,
  orgName?: string
): Promise<UserContext> {
  const [clientCountResult] = await db
    .select({ count: count() })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(eq(companies.tenantId, orgId));

  const onboarding = await db
    .select({ completedAt: userOnboarding.completedAt })
    .from(userOnboarding)
    .where(eq(userOnboarding.userId, userId))
    .limit(1);

  return {
    userId,
    orgId,
    orgName,
    userName,
    clientCount: Number(clientCountResult?.count ?? 0),
    onboardingCompleted: onboarding[0]?.completedAt != null,
  };
}

export function getPageContext(currentPath: string): PageContext {
  const segments = currentPath.split("/").filter(Boolean);
  let section = "dashboard";
  let clientId: string | undefined;

  if (segments.includes("clients")) {
    section = "klienter";
    const clientIdx = segments.indexOf("clients");
    if (segments[clientIdx + 1] && !["new"].includes(segments[clientIdx + 1])) {
      clientId = segments[clientIdx + 1];
    }
    if (segments.includes("matching")) section = "matching";
    if (segments.includes("matching-rules")) section = "matchingregler";
    if (segments.includes("import")) section = "import";
  } else if (segments.includes("companies")) {
    section = "selskaper";
  } else if (segments.includes("accounts")) {
    section = "kontoer";
  } else if (segments.includes("settings")) {
    section = "innstillinger";
  } else if (segments.includes("mva-avstemming")) {
    section = "mva-avstemming";
  }

  return { path: currentPath, section, clientId };
}

export async function getClientName(
  clientId: string,
  tenantId: string
): Promise<string | null> {
  const [row] = await db
    .select({ name: clients.name })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(and(eq(clients.id, clientId), eq(companies.tenantId, tenantId)));
  return row?.name ?? null;
}

export async function getUserMemories(
  userId: string,
  orgId: string
): Promise<string[]> {
  const rows = await db
    .select({ content: aiUserMemory.content })
    .from(aiUserMemory)
    .where(
      and(
        eq(aiUserMemory.userId, userId),
        eq(aiUserMemory.organizationId, orgId),
        sql`(${aiUserMemory.expiresAt} IS NULL OR ${aiUserMemory.expiresAt} > now())`
      )
    )
    .orderBy(sql`${aiUserMemory.lastRelevantAt} DESC`)
    .limit(10);

  return rows.map((r) => r.content);
}

export async function getClientSummary(
  clientId: string,
  tenantId: string
): Promise<{
  name: string;
  totalTransactions: number;
  unmatchedSet1: number;
  unmatchedSet2: number;
  matchCount: number;
} | null> {
  const [client] = await db
    .select({ name: clients.name, id: clients.id })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(and(eq(clients.id, clientId), eq(companies.tenantId, tenantId)));

  if (!client) return null;

  const [txCount] = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.clientId, clientId));

  const [unmatchedS1] = await db
    .select({ count: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.clientId, clientId),
        eq(transactions.setNumber, 1),
        eq(transactions.matchStatus, "unmatched")
      )
    );

  const [unmatchedS2] = await db
    .select({ count: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.clientId, clientId),
        eq(transactions.setNumber, 2),
        eq(transactions.matchStatus, "unmatched")
      )
    );

  const [matchCountResult] = await db
    .select({ count: count() })
    .from(matches)
    .where(eq(matches.clientId, clientId));

  return {
    name: client.name,
    totalTransactions: Number(txCount?.count ?? 0),
    unmatchedSet1: Number(unmatchedS1?.count ?? 0),
    unmatchedSet2: Number(unmatchedS2?.count ?? 0),
    matchCount: Number(matchCountResult?.count ?? 0),
  };
}

export async function getUnmatchedSummary(
  tenantId: string
): Promise<
  Array<{ clientId: string; clientName: string; unmatched: number }>
> {
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      unmatched: count(),
    })
    .from(transactions)
    .innerJoin(clients, eq(transactions.clientId, clients.id))
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(
      and(
        eq(companies.tenantId, tenantId),
        eq(transactions.matchStatus, "unmatched")
      )
    )
    .groupBy(clients.id, clients.name)
    .orderBy(sql`count(*) DESC`)
    .limit(20);

  return rows.map((r) => ({
    clientId: r.clientId,
    clientName: r.clientName,
    unmatched: Number(r.unmatched),
  }));
}
