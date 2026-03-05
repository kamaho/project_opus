import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

function extractPeriodDates(sub: Stripe.Subscription) {
  const items = sub.items?.data?.[0];
  const raw = sub as unknown as Record<string, unknown>;
  const periodStart = items?.current_period_start ?? raw.current_period_start;
  const periodEnd = items?.current_period_end ?? raw.current_period_end;

  return {
    currentPeriodStart: typeof periodStart === "number" ? new Date(periodStart * 1000) : null,
    currentPeriodEnd: typeof periodEnd === "number" ? new Date(periodEnd * 1000) : null,
  };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) return;

  const plan = (session.metadata?.plan ?? "starter") as
    | "starter"
    | "pro"
    | "enterprise";
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? "";
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const periods = extractPeriodDates(sub);

  await db
    .insert(subscriptions)
    .values({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan,
      status: mapStatus(sub.status),
      ...periods,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        plan,
        status: mapStatus(sub.status),
        ...periods,
        updatedAt: new Date(),
      },
    });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const plan = (sub.metadata?.plan ?? undefined) as
    | "starter"
    | "pro"
    | "enterprise"
    | undefined;
  const periods = extractPeriodDates(sub);

  const updateData: Record<string, unknown> = {
    status: mapStatus(sub.status),
    ...periods,
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    updatedAt: new Date(),
  };
  if (plan) updateData.plan = plan;

  await db
    .update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subField = (invoice as unknown as Record<string, unknown>).subscription;
  const subscriptionId =
    typeof subField === "string"
      ? subField
      : typeof subField === "object" && subField !== null && "id" in subField
        ? (subField as { id: string }).id
        : null;
  if (!subscriptionId) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
}

function mapStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "past_due" | "canceled" | "trialing" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "trialing":
      return "trialing";
    default:
      return "active";
  }
}
