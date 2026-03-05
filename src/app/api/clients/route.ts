import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getClientsByTenant } from "@/lib/db/tenant";
import { revalidateClients, revalidateAccounts } from "@/lib/revalidate";
import { seedStandardRules } from "@/lib/matching/seed-rules";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

/** GET: Liste avstemminger for org. Optional ?companyId= for å filtrere på selskap. */
export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;

  const rows = await getClientsByTenant(tenantId, companyId);
  return NextResponse.json(rows);
});

const accountSchema = z.object({
  accountNumber: z.string().min(1, "Kontonummer er påkrevd"),
  name: z.string().min(1, "Kontonavn er påkrevd"),
  type: z.enum(["ledger", "bank"], { message: "Må være 'ledger' eller 'bank'" }),
});

const createClientSchema = z.object({
  companyId: z.string().uuid("Må være en gyldig UUID"),
  name: z.string().min(1, "Navn er påkrevd").max(200, "Navn kan maks være 200 tegn"),
  set1: accountSchema,
  set2: accountSchema,
});

/** POST: Opprett avstemming med to kontoer i én transaksjon. */
export const POST = withTenant(async (req, { tenantId, userId }) => {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = createClientSchema.safeParse(raw);
    if (!parsed.success) return zodError(parsed.error);

    const { companyId, name, set1, set2 } = parsed.data;

    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)));

    if (!company) {
      return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
    }

    // Wrap all three inserts in a single transaction so no orphaned accounts are left
    // on partial failure. Use raw SQL for RETURNING to avoid schema-drift 500s.
    const result = await db.transaction(async (tx) => {
      const acct1Rows = await tx.execute<{ id: string }>(
        sql`INSERT INTO accounts (company_id, account_number, name, account_type)
            VALUES (${companyId}, ${set1.accountNumber.trim()}, ${set1.name.trim()}, ${set1.type})
            RETURNING id`
      );
      const acct2Rows = await tx.execute<{ id: string }>(
        sql`INSERT INTO accounts (company_id, account_number, name, account_type)
            VALUES (${companyId}, ${set2.accountNumber.trim()}, ${set2.name.trim()}, ${set2.type})
            RETURNING id`
      );

      const account1Id = acct1Rows[0]?.id;
      const account2Id = acct2Rows[0]?.id;
      if (!account1Id || !account2Id) {
        throw new Error("Kunne ikke opprette kontoer");
      }

      const clientRows = await tx.execute<{
        id: string;
        company_id: string;
        name: string;
        set1_account_id: string;
        set2_account_id: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>(
        sql`INSERT INTO clients (company_id, name, set1_account_id, set2_account_id)
            VALUES (${companyId}, ${name.trim()}, ${account1Id}, ${account2Id})
            RETURNING id, company_id, name, set1_account_id, set2_account_id, status, created_at, updated_at`
      );

      const created = clientRows[0];
      if (!created) throw new Error("Kunne ikke opprette avstemming");
      return created;
    });

    seedStandardRules(result.id, tenantId).catch((e) =>
      console.error("[clients] Failed to seed standard matching rules:", e)
    );

    revalidateClients();
    revalidateAccounts();

    await logAudit({
      tenantId,
      userId,
      action: "client.created",
      entityType: "client",
      entityId: result.id,
      metadata: { name: result.name },
    });

    return NextResponse.json(
      {
        id: result.id,
        companyId: result.company_id,
        name: result.name,
        set1AccountId: result.set1_account_id,
        set2AccountId: result.set2_account_id,
        status: result.status,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    console.error("[api/clients] POST error:", message, code, err);

    if (
      message.includes("duplicate") ||
      message.includes("unique") ||
      message.includes("constraint")
    ) {
      return NextResponse.json(
        { error: "En avstemming med disse kontoene finnes allerede." },
        { status: 400 }
      );
    }
    if (
      code === "42501" ||
      /policy|permission|denied|tenant|organization/i.test(message)
    ) {
      return NextResponse.json(
        {
          error:
            "Kunne ikke opprette avstemming. Sjekk at du har valgt organisasjon.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Kunne ikke opprette avstemming. Prøv igjen." },
      { status: 500 }
    );
  }
});
