import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentReportConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { effectiveNextRun } from "@/lib/agent-scheduler";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await validateClientTenant(clientId, orgId);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [config] = await db
    .select()
    .from(agentReportConfigs)
    .where(eq(agentReportConfigs.clientId, clientId));

  if (!config) {
    return NextResponse.json({
      enabled: false,
      reportTypes: ["open_items"],
      smartMatchEnabled: true,
      smartMatchSchedule: null,
      reportSchedule: null,
      specificDates: [],
      preferredTime: "03:00",
      nextMatchRun: null,
      nextReportRun: null,
      lastMatchRun: null,
      lastReportRun: null,
      lastMatchCount: null,
    });
  }

  return NextResponse.json({
    enabled: config.enabled,
    reportTypes: config.reportTypes,
    smartMatchEnabled: config.smartMatchEnabled,
    smartMatchSchedule: config.smartMatchSchedule,
    reportSchedule: config.reportSchedule,
    specificDates: config.specificDates,
    preferredTime: config.preferredTime,
    nextMatchRun: config.nextMatchRun,
    nextReportRun: config.nextReportRun,
    lastMatchRun: config.lastMatchRun,
    lastReportRun: config.lastReportRun,
    lastMatchCount: config.lastMatchCount,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await validateClientTenant(clientId, orgId);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const {
    enabled,
    reportTypes,
    smartMatchEnabled,
    smartMatchSchedule,
    reportSchedule,
    specificDates,
    preferredTime,
  } = body;

  const now = new Date();
  const prefTime = preferredTime ?? "03:00";
  const specDates = Array.isArray(specificDates) ? specificDates : [];

  const nextMatchRun =
    enabled && smartMatchEnabled && smartMatchSchedule
      ? effectiveNextRun(smartMatchSchedule, specDates, prefTime, now)
      : null;

  const nextReportRun =
    enabled && reportSchedule
      ? effectiveNextRun(reportSchedule, specDates, prefTime, now)
      : null;

  const values = {
    tenantId: orgId,
    clientId,
    createdBy: userId,
    enabled: enabled ?? false,
    reportTypes: reportTypes ?? ["open_items"],
    smartMatchEnabled: smartMatchEnabled ?? true,
    smartMatchSchedule: smartMatchSchedule ?? null,
    reportSchedule: reportSchedule ?? null,
    specificDates: specDates,
    preferredTime: prefTime,
    nextMatchRun,
    nextReportRun,
    updatedAt: now,
  };

  const [existing] = await db
    .select({ id: agentReportConfigs.id })
    .from(agentReportConfigs)
    .where(eq(agentReportConfigs.clientId, clientId));

  if (existing) {
    await db
      .update(agentReportConfigs)
      .set(values)
      .where(eq(agentReportConfigs.id, existing.id));
  } else {
    await db.insert(agentReportConfigs).values(values);
  }

  return NextResponse.json({
    ...values,
    nextMatchRun,
    nextReportRun,
  });
}
