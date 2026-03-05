import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDeadlinesForDashboard, getDeadlineSummary } from "@/lib/deadlines/queries";

export const GET = withTenant(async (req, { tenantId, userId }) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const status = url.searchParams.get("status")?.split(",").filter(Boolean) ?? undefined;
  const companyId = url.searchParams.get("company_id") ?? undefined;
  const assignedToParam = url.searchParams.get("assigned_to");
  const assignedTo = assignedToParam === "me" ? userId : assignedToParam ?? undefined;

  const [deadlineRows, summary] = await Promise.all([
    getDeadlinesForDashboard({ tenantId, from, to, status, companyId, assignedTo }),
    getDeadlineSummary(tenantId, from ?? "1970-01-01", to ?? "2099-12-31"),
  ]);

  return NextResponse.json({ deadlines: deadlineRows, summary });
});
