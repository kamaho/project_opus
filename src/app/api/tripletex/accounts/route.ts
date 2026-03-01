import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchAllPages } from "@/lib/tripletex/pagination";
import type { TxAccount } from "@/lib/tripletex/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/tripletex/accounts
 * Lists accounts from Tripletex for account selection when setting up sync.
 * Uses per-tenant credentials from DB, falling back to env vars.
 */
export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const all = await fetchAllPages<TxAccount>("/ledger/account", {
      fields: "id,number,name,isBankAccount,isInactive,type,ledgerType,requireReconciliation,displayName",
    }, orgId);

    const mapped = all
      .filter((a) => !a.isInactive)
      .map((a) => ({
        id: a.id,
        number: a.number,
        name: a.name,
        displayName: a.displayName || `${a.number} ${a.name}`,
        isBankAccount: a.isBankAccount ?? false,
        type: a.type || null,
        ledgerType: a.ledgerType || null,
        requireReconciliation: a.requireReconciliation ?? false,
      }));

    return NextResponse.json({ accounts: mapped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
