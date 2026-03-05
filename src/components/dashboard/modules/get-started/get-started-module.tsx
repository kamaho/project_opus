"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STEPS, type StepId } from "./constants";
import {
  WorkFolderSetup,
  type AccountSyncRow,
} from "./step-recommended-setup";
import { StepSmartPanel } from "./step-smart-panel";

interface GetStartedModuleProps {
  tenantId: string;
  existingHiddenModules: string[];
}

interface CompanyInfo {
  id: string;
  name: string;
}

export default function GetStartedModule({
  tenantId,
  existingHiddenModules,
}: GetStartedModuleProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("setup");

  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [accounts, setAccounts] = useState<AccountSyncRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/companies");
        if (!res.ok) return;
        const data: CompanyInfo[] = await res.json();
        if (cancelled) return;
        setCompanies(data);

        if (data.length > 0) {
          const acctRes = await fetch(
            `/api/companies/${data[0].id}/accounts`
          );
          if (acctRes.ok) {
            const acctData = await acctRes.json();
            if (!cancelled) setAccounts(acctData);
          }
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    try {
      await fetch("/api/dashboard/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardType: "agency",
          hiddenModules: [...existingHiddenModules, "get-started"],
        }),
      });
      router.refresh();
    } catch {
      // Best-effort dismiss
    }
  }, [existingHiddenModules, router]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].id);
    }
  };

  const handleBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].id);
    }
  };

  const handleFinish = () => {
    handleDismiss();
  };

  if (dismissed) return null;

  const companyId = companies[0]?.id ?? null;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-semibold">Kom i gang</h2>
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      "h-px w-6 mx-1",
                      i <= currentStepIndex ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (i <= currentStepIndex) setCurrentStep(step.id);
                  }}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    i === currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : i < currentStepIndex
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </button>
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {STEPS[currentStepIndex].label}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Lukk"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {loading && currentStep === "setup" ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {currentStep === "setup" && companyId && (
              <WorkFolderSetup
                accounts={accounts}
                companyId={companyId}
              />
            )}

            {currentStep === "setup" && !companyId && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Sett opp din arbeidsmappe</h3>
                <p className="text-sm text-muted-foreground">
                  Koble til en integrasjon under{" "}
                  <a
                    href="/dashboard/integrations"
                    className="underline underline-offset-2"
                  >
                    Integrasjoner
                  </a>{" "}
                  for å hente kontoplan og saldoer automatisk. Du kan også
                  opprette klienter manuelt under Klient avstemming.
                </p>
              </div>
            )}

            {currentStep === "smart-panel" && <StepSmartPanel />}
          </>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t px-6 py-3">
        <div>
          {currentStepIndex > 0 && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              Tilbake
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-muted-foreground"
          >
            Hopp over
          </Button>
          {currentStepIndex < STEPS.length - 1 ? (
            <Button size="sm" onClick={handleNext}>
              Neste
            </Button>
          ) : (
            <Button size="sm" onClick={handleFinish}>
              Fullfør
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
