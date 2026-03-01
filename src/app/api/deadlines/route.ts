import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { regulatoryDeadlines } from "@/lib/db/schema";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(regulatoryDeadlines);

  return NextResponse.json(rows);
}
