import { NextRequest, NextResponse } from "next/server";
import { stripe, type PlanId, PLAN_DISPLAY } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Mangler session_id" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const plan = (session.metadata?.plan ?? "starter") as PlanId;
    const interval = session.metadata?.interval ?? "month";
    const display = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.starter;

    return NextResponse.json({
      plan,
      interval,
      planName: display.name,
      price:
        interval === "year" ? display.yearlyPrice : display.monthlyPrice,
      customerEmail: session.customer_details?.email,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    });
  } catch (error) {
    console.error("[checkout/session]", error);
    return NextResponse.json(
      { error: "Kunne ikke hente øktdetaljer" },
      { status: 500 }
    );
  }
}
