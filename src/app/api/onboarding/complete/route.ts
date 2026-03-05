import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { markOnboardingComplete } from "@/lib/ai/onboarding";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  revizoEnabled: z.boolean().optional().default(false),
  firstClientCreated: z.boolean().optional().default(false),
  erpConnected: z.boolean().optional().default(false),
  userType: z.string().max(50).optional(),
  responsibilities: z.array(z.string().max(100)).optional(),
});

export const POST = withTenant(async (req, { tenantId, userId }) => {
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // no body or invalid JSON — use defaults
  }

  const parsed = bodySchema.safeParse(raw ?? {});
  const options = parsed.success ? parsed.data : {
    revizoEnabled: false,
    firstClientCreated: false,
    erpConnected: false,
  };

  await markOnboardingComplete(userId, tenantId, {
    revizoEnabled: options.revizoEnabled,
    firstClientCreated: options.erpConnected || options.firstClientCreated,
    erpConnected: options.erpConnected,
    userType: options.userType,
    responsibilities: options.responsibilities,
  });

  return NextResponse.json({ ok: true });
});
