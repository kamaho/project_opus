import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidateClients, revalidateAccounts, revalidateCompanies } from "@/lib/revalidate";
import { seedStandardRules } from "@/lib/matching/seed-rules";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

const clientItemSchema = z.object({
  companyName: z.string().min(1),
  clientName: z.string().min(1).max(200),
  set1: z.object({
    accountNumber: z.string().min(1),
    name: z.string().min(1),
    type: z.string().default("ledger"),
    currency: z.string().default("NOK"),
  }),
  set2: z.object({
    accountNumber: z.string().min(1),
    name: z.string().min(1),
    type: z.string().default("bank"),
    currency: z.string().default("NOK"),
  }),
  openingBalanceSet1: z.string().optional(),
  openingBalanceSet2: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

const bulkCreateSchema = z.object({
  items: z.array(clientItemSchema).min(1).max(500),
});

export const POST = withTenant(async (req, { tenantId, userId }) => {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = bulkCreateSchema.safeParse(raw);
    if (!parsed.success) return zodError(parsed.error);

    const { items } = parsed.data;

    const tenantCompanies = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.tenantId, tenantId));

    const companyMap = new Map(tenantCompanies.map((c) => [c.name.toLowerCase(), c.id]));

    const results = await db.transaction(async (tx) => {
      const created: { clientId: string; clientName: string; companyName: string }[] = [];

      for (const item of items) {
        let companyId = companyMap.get(item.companyName.toLowerCase());

        if (!companyId) {
          const [newCompany] = await tx.execute<{ id: string }>(
            sql`INSERT INTO companies (tenant_id, name)
                VALUES (${tenantId}, ${item.companyName.trim()})
                RETURNING id`
          );
          companyId = newCompany?.id;
          if (!companyId) throw new Error(`Kunne ikke opprette selskap: ${item.companyName}`);
          companyMap.set(item.companyName.toLowerCase(), companyId);
        }

        const [acct1] = await tx.execute<{ id: string }>(
          sql`INSERT INTO accounts (company_id, account_number, name, account_type, currency)
              VALUES (${companyId}, ${item.set1.accountNumber.trim()}, ${item.set1.name.trim()}, ${item.set1.type}, ${item.set1.currency})
              ON CONFLICT (company_id, account_number, account_type)
              DO UPDATE SET name = EXCLUDED.name
              RETURNING id`
        );

        const [acct2] = await tx.execute<{ id: string }>(
          sql`INSERT INTO accounts (company_id, account_number, name, account_type, currency)
              VALUES (${companyId}, ${item.set2.accountNumber.trim()}, ${item.set2.name.trim()}, ${item.set2.type}, ${item.set2.currency})
              ON CONFLICT (company_id, account_number, account_type)
              DO UPDATE SET name = EXCLUDED.name
              RETURNING id`
        );

        const account1Id = acct1?.id;
        const account2Id = acct2?.id;
        if (!account1Id || !account2Id) {
          throw new Error(`Kunne ikke opprette kontoer for: ${item.clientName}`);
        }

        const obSet1 = item.openingBalanceSet1 || "0";
        const obSet2 = item.openingBalanceSet2 || "0";
        const obDate = item.openingBalanceDate || null;

        const [client] = await tx.execute<{ id: string; name: string }>(
          sql`INSERT INTO clients (company_id, name, set1_account_id, set2_account_id,
                opening_balance_set1, opening_balance_set2, opening_balance_date)
              VALUES (${companyId}, ${item.clientName.trim()}, ${account1Id}, ${account2Id},
                ${obSet1}, ${obSet2}, ${obDate})
              RETURNING id, name`
        );

        if (!client?.id) throw new Error(`Kunne ikke opprette klient: ${item.clientName}`);

        created.push({
          clientId: client.id,
          clientName: client.name,
          companyName: item.companyName,
        });
      }

      return created;
    });

    for (const c of results) {
      seedStandardRules(c.clientId, tenantId).catch((e) =>
        console.error("[clients/bulk] Failed to seed rules for", c.clientId, e)
      );
    }

    revalidateCompanies();
    revalidateClients();
    revalidateAccounts();

    await logAudit({
      tenantId,
      userId,
      action: "client.created",
      entityType: "client",
      entityId: results[0]?.clientId ?? "",
      metadata: { count: results.length, companies: [...new Set(results.map((r) => r.companyName))] },
    });

    return NextResponse.json({ created: results, count: results.length }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/clients/bulk] POST error:", message, err);

    if (message.includes("duplicate") || message.includes("unique") || message.includes("constraint")) {
      return NextResponse.json(
        { error: "En eller flere avstemminger finnes allerede med disse kontoene." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: message || "Kunne ikke opprette klienter. Prøv igjen." },
      { status: 500 }
    );
  }
});
