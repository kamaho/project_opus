import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db } from "@/lib/db";
import { parserConfigs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";
import {
  jaccardSimilarity,
  FUZZY_THRESHOLD,
  autoConfigName,
} from "@/lib/parsers/header-signature";

interface StoredConfig {
  headerSignature: string;
  headerSet: string[];
  headerSample: string[];
  fileType: "csv" | "excel";
  delimiter?: string;
  decimalSeparator?: string;
  dataStartRow: number;
  columns: Record<string, number>;
  dateFormats?: Record<string, string>;
  headerExtractions?: { label: string; row: number; col: number; columnOffset: number }[];
}

/**
 * GET /api/parser-configs
 *
 * Without params: list all configs for the tenant.
 * With ?signature=X&headerSet=a,b,c: find matching config (exact first, then fuzzy).
 */
export const GET = withTenant(async (req: NextRequest, ctx) => {
  const url = new URL(req.url);
  const signature = url.searchParams.get("signature");
  const headerSetParam = url.searchParams.get("headerSet");

  if (signature) {
    const allConfigs = await db
      .select()
      .from(parserConfigs)
      .where(eq(parserConfigs.tenantId, ctx.tenantId))
      .orderBy(desc(parserConfigs.createdAt));

    const exactMatch = allConfigs.find((c) => {
      const cfg = c.config as StoredConfig;
      return cfg.headerSignature === signature;
    });

    if (exactMatch) {
      return NextResponse.json({
        config: exactMatch,
        matchType: "exact" as const,
        similarity: 1,
      });
    }

    if (headerSetParam) {
      const querySet = headerSetParam.split(",").map((s) => s.trim()).filter(Boolean);
      let bestMatch: typeof allConfigs[number] | null = null;
      let bestSimilarity = 0;

      for (const c of allConfigs) {
        const cfg = c.config as StoredConfig;
        if (!cfg.headerSet) continue;
        const sim = jaccardSimilarity(querySet, cfg.headerSet);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestMatch = c;
        }
      }

      if (bestMatch && bestSimilarity >= FUZZY_THRESHOLD) {
        return NextResponse.json({
          config: bestMatch,
          matchType: "fuzzy" as const,
          similarity: bestSimilarity,
        });
      }
    }

    return NextResponse.json({ config: null, matchType: "none", similarity: 0 });
  }

  const configs = await db
    .select()
    .from(parserConfigs)
    .where(eq(parserConfigs.tenantId, ctx.tenantId))
    .orderBy(desc(parserConfigs.createdAt));

  return NextResponse.json(configs);
});

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  fileType: z.enum(["csv", "excel"]),
  config: z.object({
    headerSignature: z.string(),
    headerSet: z.array(z.string()),
    headerSample: z.array(z.string()),
    fileType: z.enum(["csv", "excel"]),
    delimiter: z.string().optional(),
    decimalSeparator: z.string().optional(),
    dataStartRow: z.number(),
    columns: z.record(z.string(), z.number()),
    dateFormats: z.record(z.string(), z.string()).optional(),
    headerExtractions: z
      .array(
        z.object({
          label: z.string(),
          row: z.number(),
          col: z.number(),
          columnOffset: z.number(),
        })
      )
      .optional(),
  }),
  fileName: z.string().optional(),
});

/**
 * POST /api/parser-configs
 *
 * Save a new parser config with header signature.
 * Upserts on signature — if a config with the same signature already exists, it's updated.
 */
export const POST = withTenant(async (req: NextRequest, ctx) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { name, fileType, config, fileName } = parsed.data;
  const finalName =
    name || autoConfigName(config.headerSample, fileType, fileName);

  const existing = await db
    .select({ id: parserConfigs.id })
    .from(parserConfigs)
    .where(
      and(
        eq(parserConfigs.tenantId, ctx.tenantId),
      )
    );

  const existingWithSig = existing.length > 0
    ? await db
        .select()
        .from(parserConfigs)
        .where(eq(parserConfigs.tenantId, ctx.tenantId))
        .then((rows) =>
          rows.find((r) => (r.config as StoredConfig).headerSignature === config.headerSignature)
        )
    : undefined;

  if (existingWithSig) {
    await db
      .update(parserConfigs)
      .set({
        name: finalName,
        fileType,
        config,
      })
      .where(eq(parserConfigs.id, existingWithSig.id));

    const [updated] = await db
      .select()
      .from(parserConfigs)
      .where(eq(parserConfigs.id, existingWithSig.id));

    return NextResponse.json(updated);
  }

  const [created] = await db
    .insert(parserConfigs)
    .values({
      tenantId: ctx.tenantId,
      name: finalName,
      fileType,
      config,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});
