import { withTenant } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateExport } from "@/lib/export/service";

export const maxDuration = 60;

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

const comparisonDataSchema = z.object({
  clients: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      companyName: z.string(),
      set1AccountNumber: z.string(),
      set2AccountNumber: z.string(),
      openingBalanceSet1: z.number(),
      openingBalanceSet2: z.number(),
      balanceSet1: z.number(),
      balanceSet2: z.number(),
      unmatchedSumSet1: z.number(),
      unmatchedSumSet2: z.number(),
      unmatchedCountSet1: z.number(),
      unmatchedCountSet2: z.number(),
    })
  ),
  totals: z.object({
    nettoSet1: z.number(),
    nettoSet2: z.number(),
    totalUnmatchedCount: z.number(),
  }),
});

const groupMatchingDataSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string(),
  clientIds: z.array(z.string().uuid()).min(1),
  reportType: z.enum(["open"]),
});

const exportRequestSchema = z
  .object({
    module: z.enum(["mva", "matching", "comparison", "group-matching"]),
    format: z.enum(["pdf", "xlsx"]),
    mvaData: mvaDataSchema.optional(),
    matchingParams: matchingParamsSchema.optional(),
    comparisonData: comparisonDataSchema.optional(),
    groupMatchingData: groupMatchingDataSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.module === "mva") return !!data.mvaData;
      if (data.module === "matching") return !!data.matchingParams;
      if (data.module === "comparison") return !!data.comparisonData;
      if (data.module === "group-matching") return !!data.groupMatchingData;
      return false;
    },
    { message: "Mangler data for valgt modul" }
  );

export const POST = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json().catch(() => null);
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
      { tenantId, userId, userEmail }
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
    console.error("[export] Error:", err);
    return NextResponse.json({ error: "Eksport feilet" }, { status: 500 });
  }
});
