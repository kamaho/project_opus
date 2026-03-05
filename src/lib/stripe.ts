import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type PlanId = "starter" | "pro" | "enterprise";
export type IntervalId = "month" | "year";

const PRICE_MAP: Record<PlanId, Record<IntervalId, string | undefined>> = {
  starter: {
    month: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    year: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  },
  pro: {
    month: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    year: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  },
  enterprise: {
    month: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    year: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
  },
};

export function getPriceId(plan: PlanId, interval: IntervalId): string {
  const priceId = PRICE_MAP[plan]?.[interval];
  if (!priceId) {
    throw new Error(`No Stripe price configured for ${plan}/${interval}`);
  }
  return priceId;
}

export const PLAN_DISPLAY: Record<
  PlanId,
  { name: string; monthlyPrice: number; yearlyPrice: number }
> = {
  starter: { name: "Starter", monthlyPrice: 1990, yearlyPrice: 1590 },
  pro: { name: "Profesjonell", monthlyPrice: 4990, yearlyPrice: 3990 },
  enterprise: { name: "Enterprise", monthlyPrice: 9990, yearlyPrice: 7990 },
};
