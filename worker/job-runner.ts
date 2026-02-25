import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../src/lib/db/schema";
import {
  agentReportConfigs,
  agentJobLogs,
  clients,
  companies,
  transactions,
} from "../src/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { runAutoMatch } from "../src/lib/matching/engine";
import { generateExport } from "../src/lib/export/service";
import { sendAgentReportEmail } from "../src/lib/resend";
import { effectiveNextRun, isDue } from "../src/lib/agent-scheduler";

type Db = PostgresJsDatabase<typeof schema>;
type Config = typeof agentReportConfigs.$inferSelect;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function log(configId: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [job:${configId.slice(0, 8)}] ${msg}`);
}

async function getClientInfo(db: Db, clientId: string) {
  const [row] = await db
    .select({
      clientName: clients.name,
      companyName: companies.name,
      tenantId: companies.tenantId,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(eq(clients.id, clientId));

  return row;
}

async function getOpenItemStats(db: Db, clientId: string) {
  const rows = await db
    .select({
      setNumber: transactions.setNumber,
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${transactions.amount}::numeric), 0)::float`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.clientId, clientId),
        eq(transactions.matchStatus, "unmatched")
      )
    )
    .groupBy(transactions.setNumber);

  const set1 = rows.find((r) => r.setNumber === 1);
  const set2 = rows.find((r) => r.setNumber === 2);

  return {
    openItemsSet1: set1?.count ?? 0,
    openItemsSet2: set2?.count ?? 0,
    totalSet1: set1?.total ?? 0,
    totalSet2: set2?.total ?? 0,
  };
}

async function getUserEmail(createdBy: string): Promise<string | null> {
  try {
    const { createClerkClient } = await import("@clerk/backend");
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const user = await clerk.users.getUser(createdBy);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

export async function runJob(db: Db, config: Config) {
  const start = Date.now();
  const { matchDue, reportDue } = isDue(config);

  if (!matchDue && !reportDue) return;

  const jobType = matchDue && reportDue ? "both" : matchDue ? "smart_match" : "report";
  log(config.id, `Job type: ${jobType}`);

  let matchCount = 0;
  let transactionCount = 0;
  let pdfBuffer: Buffer | undefined;
  let errorMessage: string | null = null;
  let status: "success" | "failed" | "partial" = "success";

  try {
    // Step 1: Run Smart Match if due
    if (matchDue) {
      log(config.id, "Running Smart Match...");
      try {
        const result = await runAutoMatch(config.clientId, "system-agent");
        matchCount = result.totalMatches;
        transactionCount = result.totalTransactions;
        log(config.id, `Smart Match done: ${matchCount} matches, ${transactionCount} transactions`);
      } catch (err) {
        errorMessage = `Smart Match failed: ${err instanceof Error ? err.message : err}`;
        log(config.id, errorMessage);
        status = reportDue ? "partial" : "failed";
      }
    }

    // Step 2: Generate PDF report if due
    if (reportDue) {
      const reportTypes = (config.reportTypes as string[]) ?? ["open_items"];
      log(config.id, `Generating reports: ${reportTypes.join(", ")}...`);

      try {
        if (reportTypes.includes("open_items")) {
          const exportResult = await generateExport(
            {
              module: "matching",
              format: "pdf",
              matchingParams: {
                clientId: config.clientId,
                reportType: "open",
              },
            },
            {
              tenantId: config.tenantId,
              userId: config.createdBy,
              userEmail: "system@accountcontrol.no",
            }
          );
          pdfBuffer = exportResult.buffer;
          log(config.id, `PDF generated: ${exportResult.fileName}`);
        }
      } catch (err) {
        const msg = `Report generation failed: ${err instanceof Error ? err.message : err}`;
        log(config.id, msg);
        errorMessage = errorMessage ? `${errorMessage}; ${msg}` : msg;
        status = matchDue && matchCount > 0 ? "partial" : "failed";
      }
    }

    // Step 3: Send email
    if (reportDue || matchCount > 0) {
      try {
        const [clientInfo, openStats, userEmail] = await Promise.all([
          getClientInfo(db, config.clientId),
          getOpenItemStats(db, config.clientId),
          getUserEmail(config.createdBy),
        ]);

        if (userEmail && clientInfo) {
          const reportDate = new Date().toISOString().slice(0, 10);
          await sendAgentReportEmail({
            toEmail: userEmail,
            userName: userEmail.split("@")[0],
            clientName: clientInfo.clientName,
            matchCount,
            transactionCount,
            openItemsSet1: openStats.openItemsSet1,
            openItemsSet2: openStats.openItemsSet2,
            totalSet1: openStats.totalSet1,
            totalSet2: openStats.totalSet2,
            link: `${APP_URL}/dashboard/clients/${config.clientId}`,
            pdfBuffer,
            reportDate,
          });
          log(config.id, `Email sent to ${userEmail}`);
        } else {
          log(config.id, "Skipping email: no user email found");
        }
      } catch (err) {
        log(config.id, `Email failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  } catch (err) {
    errorMessage = `Unexpected error: ${err instanceof Error ? err.message : err}`;
    status = "failed";
  }

  const durationMs = Date.now() - start;

  // Log execution
  await db.insert(agentJobLogs).values({
    configId: config.id,
    tenantId: config.tenantId,
    clientId: config.clientId,
    jobType,
    status,
    matchCount,
    transactionCount,
    reportSent: !!pdfBuffer && status !== "failed",
    errorMessage,
    durationMs,
  });

  // Update config timestamps and compute next runs
  const now = new Date();
  const prefTime = config.preferredTime ?? "03:00";
  const specDates = (config.specificDates as string[]) ?? [];

  const updates: Partial<typeof agentReportConfigs.$inferInsert> = {
    updatedAt: now,
  };

  if (matchDue) {
    updates.lastMatchRun = now;
    updates.lastMatchCount = matchCount;
    updates.nextMatchRun = config.smartMatchSchedule
      ? effectiveNextRun(config.smartMatchSchedule, specDates, prefTime, now)
      : null;
  }

  if (reportDue) {
    updates.lastReportRun = now;
    updates.nextReportRun = config.reportSchedule
      ? effectiveNextRun(config.reportSchedule, specDates, prefTime, now)
      : null;
  }

  await db
    .update(agentReportConfigs)
    .set(updates)
    .where(eq(agentReportConfigs.id, config.id));

  log(config.id, `Job completed in ${durationMs}ms (status: ${status})`);
}
