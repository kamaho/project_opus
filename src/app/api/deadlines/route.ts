import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { regulatoryDeadlines } from "@/lib/db/schema";

export const GET = withTenant(async () => {
  const rows = await db.select().from(regulatoryDeadlines);

  return NextResponse.json(rows);
});
