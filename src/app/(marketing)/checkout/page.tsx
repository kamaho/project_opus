"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS: Record<string, { name: string; monthlyPrice: number; yearlyPrice: number }> = {
  starter: { name: "Starter", monthlyPrice: 1990, yearlyPrice: 1590 },
  pro: { name: "Profesjonell", monthlyPrice: 4990, yearlyPrice: 3990 },
  enterprise: { name: "Enterprise", monthlyPrice: 9990, yearlyPrice: 7990 },
};

function formatPrice(price: number) {
  return price.toLocaleString("nb-NO");
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "starter";
  const interval = searchParams.get("interval") ?? "month";
  const [loading, setLoading] = useState(false);

  const plan = PLANS[planId] ?? PLANS.starter;
  const price = interval === "year" ? plan.yearlyPrice : plan.monthlyPrice;

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
      <Link
        href="/priser"
        className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Tilbake til priser
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Bekreft bestilling
      </h1>

      <div className="mt-8 rounded-xl border border-border/50 bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Valgt pakke</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {plan.name}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {formatPrice(price)}
            </p>
            <p className="text-xs text-muted-foreground">
              kr/mnd{interval === "year" ? " (fakturert årlig)" : ""}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t border-border/50 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Prøveperiode</span>
            <span className="text-foreground">14 dager gratis</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fakturering</span>
            <span className="text-foreground">
              {interval === "year" ? "Årlig" : "Månedlig"}
            </span>
          </div>
        </div>

        <Button
          onClick={handleCheckout}
          disabled={loading}
          size="lg"
          className="mt-6 w-full"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Forbereder betaling…
            </>
          ) : (
            "Gå til betaling"
          )}
        </Button>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Sikker betaling via Stripe
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
