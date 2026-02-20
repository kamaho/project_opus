/**
 * Seed script: one company, two accounts (ledger + bank), one client, 10 standard matching rules.
 * Run: npm run seed (or SEED_TENANT_ID=your_clerk_org_id npm run seed)
 */
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

const TENANT_ID = process.env.SEED_TENANT_ID ?? "demo_tenant";

const STANDARD_RULES = [
  { priority: 1, name: "1:1 dato lik", ruleType: "one_to_one" as const, isInternal: false, dateMustMatch: true },
  { priority: 2, name: "1:1 dato ulik", ruleType: "one_to_one" as const, isInternal: false, dateMustMatch: false },
  { priority: 3, name: "Intern 1:1 dato lik", ruleType: "one_to_one" as const, isInternal: true, dateMustMatch: true },
  { priority: 4, name: "Intern 1:1 dato ulik", ruleType: "one_to_one" as const, isInternal: true, dateMustMatch: false },
  { priority: 5, name: "Mange:1 dato lik", ruleType: "many_to_one" as const, isInternal: false, dateMustMatch: true },
  { priority: 6, name: "Mange:1 dato ulik", ruleType: "many_to_one" as const, isInternal: false, dateMustMatch: false },
  { priority: 7, name: "Intern mange:1 dato lik", ruleType: "many_to_one" as const, isInternal: true, dateMustMatch: true },
  { priority: 8, name: "Intern mange:1 dato ulik", ruleType: "many_to_one" as const, isInternal: true, dateMustMatch: false },
  { priority: 9, name: "Mange:mange dato lik", ruleType: "many_to_many" as const, isInternal: false, dateMustMatch: true },
  { priority: 10, name: "Mange:mange dato ulik", ruleType: "many_to_many" as const, isInternal: false, dateMustMatch: false },
];

async function seed() {
  const { db } = await import("../src/lib/db");
  const {
    companies,
    accounts,
    clients,
    matchingRules,
  } = await import("../src/lib/db/schema");

  console.log("Seeding with tenant_id:", TENANT_ID);

  const [company] = await db
    .insert(companies)
    .values({
      tenantId: TENANT_ID,
      name: "Demo AS",
      orgNumber: "123456789",
    })
    .returning({ id: companies.id });

  if (!company) throw new Error("Failed to insert company");
  const companyId = company.id;

  const [ledgerAccount, bankAccount] = await db
    .insert(accounts)
    .values([
      { companyId, accountNumber: "1920", name: "Operasjonskonto", accountType: "ledger" },
      { companyId, accountNumber: "xxx-123", name: "Bank", accountType: "bank" },
    ])
    .returning({ id: accounts.id });

  if (!ledgerAccount || !bankAccount) throw new Error("Failed to insert accounts");

  const [client] = await db
    .insert(clients)
    .values({
      companyId,
      name: "1920",
      set1AccountId: ledgerAccount.id,
      set2AccountId: bankAccount.id,
      openingBalanceSet1: "0",
      openingBalanceSet2: "0",
      status: "active",
    })
    .returning({ id: clients.id });

  if (!client) throw new Error("Failed to insert client");

  await db.insert(matchingRules).values(
    STANDARD_RULES.map((r) => ({
      clientId: client.id,
      tenantId: TENANT_ID,
      name: r.name,
      priority: r.priority,
      ruleType: r.ruleType,
      isInternal: r.isInternal,
      dateMustMatch: r.dateMustMatch,
      isActive: true,
    }))
  );

  console.log("Seed done: 1 company, 2 accounts, 1 client, 10 matching rules.");
  if (TENANT_ID === "demo_tenant") {
    console.log("Tip: Set SEED_TENANT_ID to your Clerk organization ID and re-run to link to your org.");
  }
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
