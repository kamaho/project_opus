import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateExport } from "@/lib/export/service";

const mvaDataSchema = z.object({
  melding: z.object({
    termin: z.string(),
    totalBeregnet: z.number(),
    totalBokfort: z.number(),
    linjer: z.array(
      z.object({
        mvaKode: z.string(),
        beskrivelse: z.string(),
        grunnlag: z.number(),
        sats: z.number(),
        beregnet: z.number(),
        bokfort: z.number(),
      })
    ),
  }),
  lineOverrides: z.record(
    z.string(),
    z.object({
      category: z.string(),
      comment: z.string(),
    })
  ),
});

const matchingParamsSchema = z.object({
  clientId: z.string().uuid(),
  reportType: z.enum(["open", "closed"]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const exportRequestSchema = z
  .object({
    module: z.enum(["mva", "matching"]),
    format: z.enum(["pdf", "xlsx"]),
    mvaData: mvaDataSchema.optional(),
    matchingParams: matchingParamsSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.module === "mva") return !!data.mvaData;
      if (data.module === "matching") return !!data.matchingParams;
      return false;
    },
    { message: "Mangler data for valgt modul" }
  );

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Ugyldig JSON i forespørsel" },
      { status: 400 }
    );
  }

  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    let userEmail: string | undefined;
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      userEmail = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    } catch {
      // optional: proceed without email
    }
    const result = await generateExport(
      parsed.data as unknown as import("@/lib/export/types").ExportRequest,
      { tenantId: orgId, userId, userEmail }
    );

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Content-Length": String(result.buffer.length),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ukjent feil ved eksport";
    console.error("[export] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
