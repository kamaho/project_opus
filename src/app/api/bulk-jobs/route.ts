import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db } from "@/lib/db";
import { bulkJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/bulk-jobs?jobId=X
 *
 * Poll for bulk job progress. Tenant-scoped.
 */
export const GET = withTenant(async (req: NextRequest, ctx) => {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const [job] = await db
    .select()
    .from(bulkJobs)
    .where(and(eq(bulkJobs.id, jobId), eq(bulkJobs.tenantId, ctx.tenantId)))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
});
