import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe, getPriceId } from "@/lib/stripe";

const schema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]),
  interval: z.enum(["month", "year"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, interval } = schema.parse(body);
    const priceId = getPriceId(plan, interval);

    const origin = request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/priser`,
      metadata: { plan, interval },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ugyldig plan eller intervall" },
        { status: 400 }
      );
    }
    console.error("[checkout/create-session]", error);
    return NextResponse.json(
      { error: "Kunne ikke opprette checkout-økt" },
      { status: 500 }
    );
  }
}
