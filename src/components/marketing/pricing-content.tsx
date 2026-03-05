"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Interval = "month" | "year";

const plans = [
  {
    id: "starter" as const,
    name: "Starter",
    monthlyPrice: 1990,
    yearlyPrice: 1590,
    features: [
      "Opptil 10 klienter",
      "2 brukere",
      "1 integrasjon (Tripletex eller Visma)",
      "Smart Match",
      "Rapporter (PDF + Excel)",
      "Filimport",
      "E-postvarsler",
    ],
    cta: "Velg Starter",
    highlighted: false,
  },
  {
    id: "pro" as const,
    name: "Profesjonell",
    monthlyPrice: 4990,
    yearlyPrice: 3990,
    badge: "Mest populær",
    features: [
      "Opptil 50 klienter",
      "10 brukere",
      "Alle integrasjoner",
      "Alt i Starter, pluss:",
      "Mobil-dashboard for ledere",
      "Klientgrupper",
      "Oppgaver og frister",
      "AI-assistent",
      "Dokumentforespørsler",
      "Prioritert e-postsupport",
    ],
    cta: "Velg Profesjonell",
    highlighted: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    monthlyPrice: 9990,
    yearlyPrice: 7990,
    features: [
      "Ubegrenset klienter",
      "Ubegrenset brukere",
      "Alt i Profesjonell, pluss:",
      "Dedikert kontaktperson",
      "Tilpasset onboarding",
      "SLA-garanti",
      "API-tilgang",
    ],
    cta: "Kontakt oss",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "Kan jeg bytte pakke senere?",
    a: "Ja, oppgrader eller nedgrader når som helst. Endringen trer i kraft ved neste faktureringsperiode.",
  },
  {
    q: "Hva skjer etter prøveperioden?",
    a: "Du velger en pakke eller kontoen fryses. Ingen data slettes.",
  },
  {
    q: "Inkluderer prisen MVA?",
    a: "Nei, alle priser er eks. MVA.",
  },
  {
    q: "Kan jeg prøve gratis?",
    a: "Ja, 14 dager uten kredittkort.",
  },
  {
    q: "Hva trenger jeg for å komme i gang?",
    a: "En konto hos Tripletex eller Visma, mer trenger du ikke.",
  },
  {
    q: "Hva om jeg har flere enn 50 klienter?",
    a: "Velg Enterprise eller kontakt oss for tilpasset løsning.",
  },
];

function formatPrice(price: number) {
  return price.toLocaleString("nb-NO");
}

export function PricingContent() {
  const [interval, setInterval] = useState<Interval>("month");

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Velg pakken som passer ditt byrå
        </h1>
        <p className="mt-3 text-muted-foreground">
          Alle pakker inkluderer 14 dagers gratis prøveperiode.
        </p>

        {/* Interval toggle */}
        <div className="mt-8 inline-flex items-center rounded-full border border-border/50 bg-muted/50 p-1">
          <button
            onClick={() => setInterval("month")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              interval === "month"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Månedlig
          </button>
          <button
            onClick={() => setInterval("year")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              interval === "year"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Årlig{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              spar 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const price =
            interval === "month" ? plan.monthlyPrice : plan.yearlyPrice;
          const isEnterprise = plan.id === "enterprise";

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-xl border p-6",
                plan.highlighted
                  ? "border-brand bg-card shadow-sm"
                  : "border-border/50 bg-card"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-xs font-medium text-white">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
                    {formatPrice(price)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    kr/mnd
                  </span>
                </div>
                {interval === "year" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fakturert årlig
                  </p>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    {f.endsWith(":") ? (
                      <span className="mt-2 text-xs font-medium text-muted-foreground">
                        {f}
                      </span>
                    ) : (
                      <>
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-muted-foreground">{f}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <Button
                  variant={plan.highlighted ? "default" : "outline"}
                  className="w-full"
                  asChild
                >
                  {isEnterprise ? (
                    <a href="mailto:hei@revizo.ai?subject=Enterprise%20-%20Revizo">
                      {plan.cta}
                    </a>
                  ) : (
                    <Link href="/sign-up">
                      Kom i gang
                    </Link>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mx-auto mt-20 max-w-3xl">
        <h2 className="text-center text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Vanlige spørsmål
        </h2>
        <div className="mt-8 divide-y divide-border/50">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground">
                {faq.q}
                <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
