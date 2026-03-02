import { withTenant, requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tripletexConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createTripletexSession } from "@/lib/tripletex";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/tripletex/connect
 * Verifies Tripletex credentials and saves them for the tenant.
 */
export const POST = withTenant(async (req, ctx) => {
  requireAdmin(ctx);
  const { tenantId } = ctx;
  const body = await req.json();
  const { consumerToken, employeeToken } = body as {
    consumerToken?: string;
    employeeToken?: string;
  };

  const isTest = Boolean(body?.isTest);

  if (!consumerToken?.trim() || !employeeToken?.trim()) {
    return NextResponse.json(
      { error: "Consumer token og employee token er påkrevd" },
      { status: 400 }
    );
  }

  function padBase64(token: string): string {
    const t = token.trim();
    const remainder = t.length % 4;
    if (remainder === 0) return t;
    return t + "=".repeat(4 - remainder);
  }

  const paddedConsumer = padBase64(consumerToken);
  const paddedEmployee = padBase64(employeeToken);

  const PROD_URL = "https://tripletex.no/v2";
  const TEST_URL = "https://api-test.tripletex.tech/v2";
  const envUrl = process.env.TRIPLETEX_API_BASE_URL;

  const baseUrl = isTest
    ? TEST_URL
    : envUrl && envUrl !== PROD_URL
      ? envUrl
      : PROD_URL;

  try {
    const sessionToken = await createTripletexSession(
      baseUrl,
      paddedConsumer,
      paddedEmployee
    );

    const authHeader = Buffer.from(`0:${sessionToken}`).toString("base64");
    const whoamiRes = await fetch(`${baseUrl}/token/session/>whoAmI`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });

    if (!whoamiRes.ok) {
      return NextResponse.json(
        { error: "Tilkobling verifisert men whoAmI feilet. Sjekk at nøklene har riktige tilganger." },
        { status: 400 }
      );
    }

    const whoami = await whoamiRes.json();

    const encryptedConsumer = encrypt(paddedConsumer);
    const encryptedEmployee = encrypt(paddedEmployee);

    const [connection] = await db
      .insert(tripletexConnections)
      .values({
        tenantId,
        consumerToken: encryptedConsumer,
        employeeToken: encryptedEmployee,
        baseUrl,
        label: whoami.value?.company?.name ?? null,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [tripletexConnections.tenantId],
        set: {
          consumerToken: encryptedConsumer,
          employeeToken: encryptedEmployee,
          baseUrl,
          label: whoami.value?.company?.name ?? null,
          isActive: true,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAudit({ tenantId, userId: ctx.userId, action: "tripletex.connected", entityType: "tripletex_connection", entityId: connection.id, metadata: { label: connection.label } });

    return NextResponse.json({
      ok: true,
      connection: {
        id: connection.id,
        label: connection.label,
        verifiedAt: connection.verifiedAt,
      },
      company: whoami.value?.company ?? null,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Ukjent feil";
    console.error("[tripletex/connect] Connection failed:", raw);
    const friendly = parseTripletexError(raw);
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
});

function parseTripletexError(raw: string): string {
  try {
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) return "Kunne ikke koble til Tripletex. Sjekk at nøklene er korrekte.";

    const parsed = JSON.parse(raw.slice(jsonStart));
    const validationMessages: Array<{ field?: string; message?: string }> =
      parsed.validationMessages ?? [];

    if (validationMessages.length > 0) {
      const field = validationMessages[0].field ?? "";
      const msg = validationMessages[0].message ?? "";

      if (field.includes("consumerToken")) {
        return "Consumer token er ugyldig eller finnes ikke. Sjekk at du har kopiert riktig token fra Tripletex.";
      }
      if (field.includes("employeeToken")) {
        return "Employee token er ugyldig eller finnes ikke. Sjekk at du har kopiert riktig token fra Tripletex.";
      }
      return msg || "Validering feilet. Sjekk at begge nøklene er korrekte.";
    }

    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Could not parse — use fallback
  }

  if (raw.includes("session creation failed")) {
    return "Kunne ikke opprette sesjon mot Tripletex. Sjekk at API-nøklene er korrekte og har riktige tilganger.";
  }

  return "Kunne ikke koble til Tripletex. Sjekk at nøklene er korrekte og prøv igjen.";
}

/**
 * GET /api/tripletex/connect
 * Returns the current tenant's Tripletex connection status.
 */
export const GET = withTenant(async (_req, { tenantId }) => {
  const [connection] = await db
    .select({
      id: tripletexConnections.id,
      label: tripletexConnections.label,
      isActive: tripletexConnections.isActive,
      verifiedAt: tripletexConnections.verifiedAt,
    })
    .from(tripletexConnections)
    .where(eq(tripletexConnections.tenantId, tenantId))
    .limit(1);

  return NextResponse.json({ connection: connection ?? null });
});
