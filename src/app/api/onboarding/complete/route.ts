import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { markOnboardingComplete } from "@/lib/ai/onboarding";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req, { tenantId, userId }) => {
  let options: {
    revizoEnabled?: boolean;
    firstClientCreated?: boolean;
    erpConnected?: boolean;
  } = {};
  let checkoutInfo: {
    plan?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  } = {};

  try {
    const body = await req.json();
    options = {
      revizoEnabled: Boolean(body?.revizoEnabled),
      firstClientCreated: Boolean(body?.erpConnected || body?.firstClientCreated),
      erpConnected: Boolean(body?.erpConnected),
      userType: body?.userType ?? undefined,
      responsibilities: Array.isArray(body?.responsibilities)
        ? body.responsibilities
        : undefined,
    };
    if (body?.checkout) {
      checkoutInfo = body.checkout;
    }
  } catch {
    // no body or invalid JSON
  }

  await markOnboardingComplete(userId, tenantId, options);

  if (checkoutInfo.stripeSubscriptionId && checkoutInfo.stripeCustomerId) {
    const plan = (checkoutInfo.plan ?? "starter") as "starter" | "pro" | "enterprise";
    try {
      const existing = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, checkoutInfo.stripeSubscriptionId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(subscriptions)
          .set({ tenantId, updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, checkoutInfo.stripeSubscriptionId));
      } else {
        await db.insert(subscriptions).values({
          tenantId,
          stripeCustomerId: checkoutInfo.stripeCustomerId,
          stripeSubscriptionId: checkoutInfo.stripeSubscriptionId,
          plan,
          status: "active",
        });
      }
    } catch (err) {
      console.error("[onboarding/complete] Failed to link subscription:", err);
    }
  }

  return NextResponse.json({ ok: true });
});
