"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Database, BarChart3, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    label: "Kobler til Tripletex",
    description: "Oppretter sikker tilkobling",
    icon: Shield,
    durationMs: 3_000,
  },
  {
    label: "Henter kontoliste",
    description: "Laster ned kontoplan med alle kontoer",
    icon: Database,
    durationMs: 8_000,
  },
  {
    label: "Henter saldoer",
    description: "Henter inngående og utgående saldo per konto",
    icon: BarChart3,
    durationMs: 20_000,
  },
  {
    label: "Klargjør data",
    description: "Lagrer kontoplan og saldoer i Revizo",
    icon: Sparkles,
    durationMs: 5_000,
  },
];

export function SyncInProgressView() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let active = true;

    const tick = () => {
      if (!active) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timeoutId = setTimeout(tick, 5_000);
        return;
      }
      router.refresh();
      timeoutId = setTimeout(tick, 10_000);
    };

    timeoutId = setTimeout(tick, 10_000);
    return () => { active = false; clearTimeout(timeoutId); };
  }, [router]);

  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed((prev) => prev + 500);
    }, 500);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cumulative = 0;
    for (let i = 0; i < STEPS.length; i++) {
      cumulative += STEPS[i].durationMs;
      if (elapsed < cumulative) {
        setActiveStep(i);
        return;
      }
    }
    setActiveStep(STEPS.length - 1);
  }, [elapsed]);

  const currentStepCumulative = STEPS.slice(0, activeStep).reduce(
    (sum, s) => sum + s.durationMs,
    0
  );
  const currentStepElapsed = elapsed - currentStepCumulative;
  const currentStepDuration = STEPS[activeStep]?.durationMs ?? 1;
  const stepProgress = Math.min(
    currentStepElapsed / currentStepDuration,
    1
  );

  const totalDuration = STEPS.reduce((sum, s) => sum + s.durationMs, 0);
  const overallProgress = Math.min(elapsed / totalDuration, 0.95);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Klient avstemming</h1>

      <div className="rounded-lg border bg-card p-8 max-w-lg mx-auto">
        <div className="space-y-6">
          {/* Overall progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Synkronisering pågår</span>
              <span>{Math.round(overallProgress * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${overallProgress * 100}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-1">
            {STEPS.map((step, i) => {
              const isCompleted = i < activeStep;
              const isActive = i === activeStep;
              const isPending = i > activeStep;
              const Icon = step.icon;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-300",
                    isActive && "bg-emerald-50/50 dark:bg-emerald-950/20",
                  )}
                >
                  <div className="mt-0.5">
                    {isCompleted ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                    ) : isActive ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium transition-colors",
                        isPending && "text-muted-foreground/50",
                        isActive && "text-foreground",
                        isCompleted && "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    {(isActive || isCompleted) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isCompleted ? "Fullført" : step.description}
                      </p>
                    )}
                    {isActive && (
                      <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400/60 transition-all duration-500 ease-out"
                          style={{ width: `${stepProgress * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center pt-2">
            Siden oppdateres automatisk når alt er klart
          </p>
        </div>
      </div>
    </div>
  );
}
