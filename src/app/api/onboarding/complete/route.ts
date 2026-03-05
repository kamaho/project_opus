import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { markOnboardingComplete } from "@/lib/ai/onboarding";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req, { tenantId, userId }) => {
  let options: {
    revizoEnabled?: boolean;
    firstClientCreated?: boolean;
    erpConnected?: boolean;
    userType?: string;
    responsibilities?: string[];
  } = {};
  let checkoutSessionId: string | undefined;

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
    if (body?.checkout?.sessionId) {
      checkoutSessionId = String(body.checkout.sessionId);
    }
  } catch {
    // no body or invalid JSON
  }

  await markOnboardingComplete(userId, tenantId, options);

  if (checkoutSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

      const user = await currentUser();
      const userEmail = user?.emailAddresses?.[0]?.emailAddress;
      if (
        !userEmail ||
        session.customer_details?.email?.toLowerCase() !== userEmail.toLowerCase()
      ) {
        console.warn(
          `[onboarding/complete] Email mismatch: session=${session.customer_details?.email}, user=${userEmail}`
        );
        return NextResponse.json({ ok: true });
      }

      const stripeSubscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      const stripeCustomerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

      if (stripeSubscriptionId && stripeCustomerId) {
        const plan = (session.metadata?.plan ?? "starter") as "starter" | "pro" | "enterprise";

        const existing = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(subscriptions)
            .set({ tenantId, updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
        } else {
          await db.insert(subscriptions).values({
            tenantId,
            stripeCustomerId,
            stripeSubscriptionId,
            plan,
            status: "active",
          });
        }
      }
    } catch (err) {
      console.error("[onboarding/complete] Failed to link subscription:", err);
    }
  }

  return NextResponse.json({ ok: true });
});
