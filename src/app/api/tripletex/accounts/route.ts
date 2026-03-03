import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { TripletexError } from "@/lib/tripletex";
import { fetchAllPages } from "@/lib/tripletex/pagination";
import type { TxAccount } from "@/lib/tripletex/types";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (_req, { tenantId }) => {
  try {
    const all = await fetchAllPages<TxAccount>("/ledger/account", {
      fields: "id,number,name,isBankAccount,isInactive,type,ledgerType,requireReconciliation,displayName",
    }, tenantId);

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
    console.error("[tripletex/accounts]", error);
    const message = error instanceof TripletexError
      ? error.userMessage
      : "Kunne ikke hente kontoer fra Tripletex. Sjekk tilkoblingen.";
    const status = error instanceof TripletexError ? Math.max(error.statusCode, 400) : 502;
    return NextResponse.json({ error: message }, { status });
  }
});
