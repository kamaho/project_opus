"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SetupWizard, type SetupResult } from "@/components/setup/setup-wizard";
import { StepChoosePath } from "@/components/onboarding/step-choose-path";
import { StepSelectERP } from "@/components/onboarding/step-select-erp";
import { StepConfigureERP, type ERPSetupResult } from "@/components/onboarding/step-configure-erp";
import { StepConfigureVismaNxt } from "@/components/onboarding/step-configure-visma-nxt";
import { StepConnectBank } from "@/components/onboarding/step-connect-bank";
import { StepInviteTeam } from "@/components/onboarding/step-invite-team";
import {
  StepUserProfile,
  type UserType,
  type Responsibility,
} from "@/components/onboarding/step-user-profile";

// ---------------------------------------------------------------------------
// Step definitions per path
// ---------------------------------------------------------------------------

type OnboardingPath = "integration" | "manual" | null;

interface StepDef {
  id: string;
  label: string;
}

function getSteps(path: OnboardingPath, showTeamStep: boolean): StepDef[] {
  const steps: StepDef[] = [{ id: "welcome", label: "Velkommen" }];

  if (showTeamStep) {
    steps.push({ id: "invite-team", label: "Team" });
  }

  steps.push({ id: "choose-path", label: "Oppsett" });

  if (path === "integration") {
    steps.push(
      { id: "select-erp", label: "System" },
      { id: "configure-erp", label: "Tilkobling" },
      { id: "connect-bank", label: "Bank" }
    );
  } else if (path === "manual") {
    steps.push({ id: "manual-setup", label: "Manuelt" });
  }

  steps.push(
    { id: "user-profile", label: "Profil" },
    { id: "ready", label: "Klar" }
  );

  return steps;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const STORAGE_KEY = "revizo_onboarding_state";

interface PersistedState {
  step: number;
  path: OnboardingPath;
  selectedErpId: string | null;
  userType?: string | null;
  responsibilities?: string[];
}

function loadPersistedState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedState;
  } catch {
    return {};
  }
}

function persistState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded or SSR — ignore */ }
}

function clearPersistedState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export default function OnboardingPage() {
  const [showIntro, setShowIntro] = useState(() => {
    const saved = loadPersistedState();
    return saved.step == null || saved.step === 0;
  });
  const [step, setStep] = useState(() => loadPersistedState().step ?? 0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [path, setPath] = useState<OnboardingPath>(() => loadPersistedState().path ?? null);
  const [selectedErpId, setSelectedErpId] = useState<string | null>(() => loadPersistedState().selectedErpId ?? null);
  const [userType, setUserType] = useState<UserType | null>(
    () => (loadPersistedState().userType as UserType) ?? null
  );
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(
    () => (loadPersistedState().responsibilities as Responsibility[]) ?? []
  );

  const [, setSetupResult] = useState<SetupResult | null>(null);
  const [erpResult, setErpResult] = useState<ERPSetupResult | null>(null);
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, membership, isLoaded: orgLoaded } = useOrganization();
  const router = useRouter();

  // Show team step for admins or users without an org (they'll create one)
  // Skip for invited members (non-admin with existing membership)
  const showTeamStep = !membership || membership.role === "org:admin";

  const steps = useMemo(() => getSteps(path, showTeamStep), [path, showTeamStep]);
  const currentStepId = steps[step]?.id ?? "welcome";

  useEffect(() => {
    persistState({ step, path, selectedErpId, userType, responsibilities });
  }, [step, path, selectedErpId, userType, responsibilities]);

  function goTo(nextStep: number) {
    setDirection(nextStep > step ? "forward" : "back");
    setStep(nextStep);
  }

  function goToStepId(id: string) {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx >= 0) goTo(idx);
  }

  function handleBack() {
    if (currentStepId === "select-erp" || currentStepId === "manual-setup") {
      setPath(null);
      goToStepId("choose-path");
      return;
    }
    goTo(step - 1);
  }

  function handleChoosePath(chosen: "integration" | "manual") {
    setPath(chosen);
    // After setting path, the steps array changes. We need to go to the next step
    // which is index 2 (or 3 if team step is shown)
    const newSteps = getSteps(chosen, showTeamStep);
    const nextIdx = newSteps.findIndex(
      (s) => s.id === (chosen === "integration" ? "select-erp" : "manual-setup")
    );
    if (nextIdx >= 0) {
      setDirection("forward");
      setStep(nextIdx);
    }
  }

  const [finishing, setFinishing] = useState(false);

  async function handleFinish() {
    if (!organization) {
      toast.error("Velg eller opprett en organisasjon først.");
      return;
    }
    setFinishing(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          erpConnected: (erpResult?.companies?.length ?? 0) > 0,
          userType,
          responsibilities,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Kunne ikke fullføre onboarding. Prøv igjen.");
        setFinishing(false);
        return;
      }
      clearPersistedState();
      router.push("/dashboard");
    } catch {
      toast.error("Nettverksfeil — sjekk tilkoblingen og prøv igjen.");
      setFinishing(false);
    }
  }

  if (showIntro) {
    return <IntroAnimation onComplete={() => setShowIntro(false)} />;
  }

  if (!userLoaded) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  const firstName = user?.firstName || "der";

  const wideSteps = ["configure-erp", "select-erp", "connect-bank", "invite-team", "user-profile"];
  const maxWidth = wideSteps.includes(currentStepId) ? "max-w-3xl" : "max-w-xl";

  return (
    <div className={cn("w-full mx-auto", maxWidth)}>
      {/* Progress indicator with back button */}
      <div className="relative flex items-center justify-center mb-12">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="absolute left-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Tilbake</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
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
      </div>

      {/* Step content */}
      <div
        key={currentStepId}
        className={cn(
          "animate-in fade-in duration-300",
          direction === "forward"
            ? "slide-in-from-right-4"
            : "slide-in-from-left-4"
        )}
      >
        {currentStepId === "welcome" && (
          <StepWelcome firstName={firstName} onNext={() => goTo(1)} />
        )}

        {currentStepId === "invite-team" && (
          <StepInviteTeam onNext={() => goToStepId("choose-path")} />
        )}

        {currentStepId === "choose-path" && (
          <StepChoosePath onChoose={handleChoosePath} />
        )}

        {/* Integration path */}
        {currentStepId === "select-erp" && (
          <StepSelectERP
            onSelect={(erpId) => {
              setSelectedErpId(erpId);
              goToStepId("configure-erp");
            }}
          />
        )}

        {currentStepId === "configure-erp" && selectedErpId && (
          selectedErpId === "visma-nxt" ? (
            <StepConfigureVismaNxt
              onComplete={() => {
                goToStepId("connect-bank");
              }}
            />
          ) : (
            <StepConfigureERP
              erpId={selectedErpId}
              onComplete={(result) => {
                setErpResult(result);
                goToStepId("connect-bank");
              }}
            />
          )
        )}

        {currentStepId === "connect-bank" && (
          <StepConnectBank
            onContinue={() => goToStepId("user-profile")}
          />
        )}

        {/* Manual path */}
        {currentStepId === "manual-setup" && (
          <div className="space-y-4">
            {!orgLoaded ? (
              <div className="flex justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              </div>
            ) : !organization ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-6 text-center space-y-3">
                <Building2 className="h-10 w-10 mx-auto text-amber-600 dark:text-amber-400" />
                <h3 className="font-semibold text-foreground">Velg eller opprett organisasjon</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Du må ha en organisasjon for å sette opp avstemming. Bruk organisasjonsvelgeren øverst ved logoen.
                </p>
              </div>
            ) : (
              <>
                <SetupWizard
                  mode="fullscreen"
                  hideProgress
                  onComplete={(result) => {
                    setSetupResult(result);
                    goToStepId("user-profile");
                  }}
                />
                <div className="text-center">
                  <button
                    onClick={() => goToStepId("user-profile")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Hopp over — jeg setter opp avstemming senere
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* User profile */}
        {currentStepId === "user-profile" && (
          <StepUserProfile
            initialUserType={userType}
            initialResponsibilities={responsibilities}
            onComplete={(data) => {
              setUserType(data.userType);
              setResponsibilities(data.responsibilities);
              goToStepId("ready");
            }}
          />
        )}

        {currentStepId === "ready" && (
          <StepReady onFinish={handleFinish} canFinish={!!organization} finishing={finishing} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Intro Animation                                                     */
/* ------------------------------------------------------------------ */

function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<
    "initial" | "swap" | "wipe" | "brand" | "done"
  >("initial");
  const containerRef = useRef<HTMLDivElement>(null);

  const advance = useCallback(() => {
    setPhase((p) => {
      switch (p) {
        case "initial": return "swap";
        case "swap":    return "wipe";
        case "wipe":    return "brand";
        case "brand":   return "done";
        default:        return p;
      }
    });
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => advance(), 1500));
    timers.push(setTimeout(() => advance(), 3900));
    timers.push(setTimeout(() => advance(), 4700));
    timers.push(setTimeout(() => advance(), 6400));
    return () => timers.forEach(clearTimeout);
  }, [advance]);

  useEffect(() => {
    if (phase === "done") onComplete();
  }, [phase, onComplete]);

  const showSwapped = phase === "swap" || phase === "wipe" || phase === "brand" || phase === "done";
  const showWipe    = phase === "wipe" || phase === "brand" || phase === "done";
  const showBrand   = phase === "brand" || phase === "done";

  return (
    <div
      ref={containerRef}
      className="intro-easing fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden"
    >
      {/* Text phase */}
      <div
        className="relative text-center w-full"
        style={{ display: showBrand ? "none" : undefined }}
      >
        <div
          className="flex items-center justify-center gap-[0.25em] leading-none"
          style={{
            fontSize: "clamp(2rem, 8vw, 6rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            height: "1.2em",
          }}
        >
          <span
            className="inline-flex relative overflow-hidden items-center"
            style={{ height: "1.2em" }}
          >
            <span
              className={cn("intro-word inline-block", showSwapped && "intro-exit-up")}
            >
              Besøk av
            </span>
            {showSwapped && (
              <span className="intro-word intro-enter-up inline-block absolute left-0">
                klar for
              </span>
            )}
          </span>

          <span
            className="inline-flex relative overflow-hidden items-center"
            style={{ height: "1.2em" }}
          >
            <span className={cn("intro-word inline-block", showWipe && "intro-exit-up")}>
              revisor?
            </span>
          </span>
        </div>
      </div>

      {/* Brand reveal */}
      {showBrand && (
        <div className="intro-brand-active fixed inset-0 flex items-center justify-center">
          <Image
            src="/logo-revizo.svg"
            alt="Revizo"
            width={400}
            height={100}
            className="h-16 sm:h-20 md:h-24 w-auto"
            priority
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: Welcome                                                       */
/* ------------------------------------------------------------------ */

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
        <h1 className="text-3xl font-semibold tracking-tight">
          Velkommen, {firstName}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto mt-3">
          Revizo er et moderne avstemmingsverktøy som gjør regnskapsarbeidet
          enklere, raskere og mer nøyaktig.
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="gap-2">
        Kom i gang
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: Ready                                                         */
/* ------------------------------------------------------------------ */

function StepReady({ onFinish, canFinish = true, finishing = false }: { onFinish: () => void; canFinish?: boolean; finishing?: boolean }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-violet-600" />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Du er klar!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Alt er satt opp. Revizo er klar for deg — start avstemmingen og la
          dataene flyte automatisk.
        </p>
      </div>
      {!canFinish && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Velg eller opprett en organisasjon øverst ved logoen for å fullføre.
        </p>
      )}
      <Button size="lg" onClick={onFinish} className="gap-2" disabled={!canFinish || finishing}>
        {finishing ? "Fullfører..." : "Start avstemming"}
        {!finishing && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
