import { db } from "@/lib/db";
import { matchingRules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Standard rule set based on the domain spec (10 rules).
 * Seeded when a client is first set up for matching.
 */
const STANDARD_RULES = [
  {
    name: "1:1 med lik dato",
    priority: 1,
    ruleType: "one_to_one" as const,
    isInternal: false,
    dateMustMatch: true,
    dateToleranceDays: 0,
  },
  {
    name: "1:1 uten datokrav",
    priority: 2,
    ruleType: "one_to_one" as const,
    isInternal: false,
    dateMustMatch: false,
    dateToleranceDays: 0,
  },
  {
    name: "Intern 1:1 med lik dato",
    priority: 3,
    ruleType: "one_to_one" as const,
    isInternal: true,
    dateMustMatch: true,
    dateToleranceDays: 0,
  },
  {
    name: "Intern 1:1 uten datokrav",
    priority: 4,
    ruleType: "one_to_one" as const,
    isInternal: true,
    dateMustMatch: false,
    dateToleranceDays: 0,
  },
  {
    name: "Mange:1 med lik dato",
    priority: 5,
    ruleType: "many_to_one" as const,
    isInternal: false,
    dateMustMatch: true,
    dateToleranceDays: 0,
  },
  {
    name: "Mange:1 uten datokrav",
    priority: 6,
    ruleType: "many_to_one" as const,
    isInternal: false,
    dateMustMatch: false,
    dateToleranceDays: 0,
  },
  {
    name: "Intern Mange:1 med lik dato",
    priority: 7,
    ruleType: "many_to_one" as const,
    isInternal: true,
    dateMustMatch: true,
    dateToleranceDays: 0,
  },
  {
    name: "Intern Mange:1 uten datokrav",
    priority: 8,
    ruleType: "many_to_one" as const,
    isInternal: true,
    dateMustMatch: false,
    dateToleranceDays: 0,
  },
  {
    name: "Mange:Mange med lik dato",
    priority: 9,
    ruleType: "many_to_many" as const,
    isInternal: false,
    dateMustMatch: true,
    dateToleranceDays: 0,
  },
  {
    name: "Mange:Mange uten datokrav",
    priority: 10,
    ruleType: "many_to_many" as const,
    isInternal: false,
    dateMustMatch: false,
    dateToleranceDays: 0,
  },
];

/**
 * Seed the standard 10-rule set for a client.
 * Skips if rules already exist for the client.
 */
export async function seedStandardRules(
  clientId: string,
  tenantId: string
): Promise<{ seeded: number; skipped: boolean }> {
  const existing = await db
    .select({ id: matchingRules.id })
    .from(matchingRules)
    .where(eq(matchingRules.clientId, clientId))
    .limit(1);

  if (existing.length > 0) {
    return { seeded: 0, skipped: true };
  }

  const values = STANDARD_RULES.map((r) => ({
    clientId,
    tenantId,
    ...r,
    compareCurrency: "local" as const,
    allowTolerance: false,
    toleranceAmount: "0",
    conditions: [],
    isActive: !r.isInternal,
  }));

  await db.insert(matchingRules).values(values);
  return { seeded: values.length, skipped: false };
}
