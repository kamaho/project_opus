"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionInfo {
  plan: string;
  planName: string;
  price: number;
  interval: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    fetch(`/api/checkout/session?id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setSession(data);
        localStorage.setItem(
          "revizo_checkout",
          JSON.stringify({
            plan: data.plan,
            stripeCustomerId: data.stripeCustomerId,
            stripeSubscriptionId: data.stripeSubscriptionId,
            sessionId,
          })
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
          Betaling mottatt!
        </h1>

        {session && (
          <p className="mt-3 text-muted-foreground">
            Du har valgt:{" "}
            <span className="font-semibold text-foreground">
              {session.planName}
            </span>{" "}
            —{" "}
            <span className="font-mono tabular-nums">
              {session.price.toLocaleString("nb-NO")}
            </span>{" "}
            kr/mnd
            {session.interval === "year" ? " (fakturert årlig)" : ""}
          </p>
        )}

        <p className="mt-2 text-sm text-muted-foreground">
          Neste steg: Opprett kontoen din for å komme i gang.
        </p>

        <Button size="lg" className="mt-8" asChild>
          <Link href="/sign-up">
            Opprett konto
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
