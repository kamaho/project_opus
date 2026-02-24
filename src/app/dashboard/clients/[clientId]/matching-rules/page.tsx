import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { validateClientTenant } from "@/lib/db/tenant";
import { db } from "@/lib/db";
import { matchingRules } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { MatchingRulesClient } from "@/components/matching/matching-rules-client";

export default async function MatchingRulesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { orgId } = await auth();
  const { clientId } = await params;
  if (!orgId) notFound();

  const row = await validateClientTenant(clientId, orgId);
  if (!row) notFound();

  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.clientId, clientId))
    .orderBy(asc(matchingRules.priority));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Matching-regler</h1>
      </div>
      <MatchingRulesClient clientId={clientId} initialRules={rules} />
    </div>
  );
}
