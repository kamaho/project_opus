"use client";

import { useState, useEffect } from "react";
import { useUser, useOrganization, CreateOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Upload,
  Bell,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "welcome", label: "Velkommen" },
  { id: "features", label: "Funksjoner" },
  { id: "organization", label: "Organisasjon" },
  { id: "ready", label: "Klar" },
] as const;

const FEATURES = [
  {
    icon: Zap,
    title: "Smart Match",
    description:
      "AI-drevet matching som automatisk finner og avstemmer poster mellom regnskap og bank.",
  },
  {
    icon: Upload,
    title: "Universell import",
    description:
      "Last opp filer fra alle systemer. Vi tolker formatet og mapper kolonnene automatisk.",
  },
  {
    icon: Bell,
    title: "Varsler i sanntid",
    description:
      "Få notifikasjoner på e-post og i appen når noe viktig skjer.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const router = useRouter();

  const hasOrg = orgLoaded && !!organization;

  function goTo(nextStep: number) {
    setDirection(nextStep > step ? "forward" : "back");
    setStep(nextStep);
  }

  function handleFinish() {
    localStorage.setItem("onboarding_completed", "true");
    router.push("/dashboard");
  }

  useEffect(() => {
    if (step === 2 && hasOrg) {
      const t = setTimeout(() => goTo(3), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hasOrg]);

  if (!userLoaded) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  const firstName = user?.firstName || "der";

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "rounded-full transition-all duration-300",
              i === step
                ? "h-2 w-8 bg-foreground"
                : i < step
                  ? "h-2 w-2 bg-foreground/30"
                  : "h-2 w-2 bg-border"
            )}
          />
        ))}
      </div>

      {/* Step content with key-based remount for animation */}
      <div
        key={step}
        className={cn(
          "animate-in fade-in duration-300",
          direction === "forward"
            ? "slide-in-from-right-4"
            : "slide-in-from-left-4"
        )}
      >
        {step === 0 && <StepWelcome firstName={firstName} onNext={() => goTo(1)} />}
        {step === 1 && <StepFeatures onNext={() => goTo(2)} />}
        {step === 2 && (
          <StepOrganization
            hasOrg={hasOrg}
            orgName={organization?.name}
            onSkip={() => goTo(3)}
          />
        )}
        {step === 3 && <StepReady onFinish={handleFinish} />}
      </div>
    </div>
  );
}

function StepWelcome({
  firstName,
  onNext,
}: {
  firstName: string;
  onNext: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-lg font-semibold tracking-tight">
            Account Control
          </span>
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Velkommen, {firstName}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto mt-3">
          Account Control er et moderne avstemmingsverktøy som gjør
          regnskapsarbeidet enklere, raskere og mer nøyaktig.
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="gap-2">
        Kom i gang
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StepFeatures({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Kraftige verktøy for regnskapsførere
        </h2>
        <p className="text-muted-foreground">
          Alt du trenger for effektiv avstemming, samlet i én plattform.
        </p>
      </div>

      <div className="grid gap-3">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="flex gap-4 items-start rounded-md border bg-card p-4 text-left"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <f.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{f.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {f.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={onNext} className="gap-2">
          Neste
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepOrganization({
  hasOrg,
  orgName,
  onSkip,
}: {
  hasOrg: boolean;
  orgName?: string | null;
  onSkip: () => void;
}) {
  if (hasOrg) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
        </div>
        <div>
          <p className="font-medium">{orgName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Organisasjonen din er klar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Opprett din organisasjon
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Alle brukere og kontoer tilhører en organisasjon. Opprett en for å
          komme i gang.
        </p>
      </div>

      <div className="flex justify-center">
        <CreateOrganization
          skipInvitationScreen
          appearance={{
            elements: {
              rootBox: "w-full max-w-sm mx-auto",
              card: "shadow-none border rounded-md",
            },
          }}
        />
      </div>

      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Hopp over for nå
        </button>
      </div>
    </div>
  );
}

function StepReady({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Du er klar!</h2>
        <p className="text-muted-foreground">
          Alt er satt opp. Gå til dashboardet for å begynne å jobbe.
        </p>
      </div>
      <Button size="lg" onClick={onFinish} className="gap-2">
        Gå til Dashboard
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
