"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Link2,
  ArrowRight,
} from "lucide-react";

export interface VismaNxtSetupResult {
  connected: boolean;
  companyName?: string;
}

interface StepConfigureVismaNxtProps {
  onComplete: (result: VismaNxtSetupResult) => void;
}

export function StepConfigureVismaNxt({
  onComplete,
}: StepConfigureVismaNxtProps) {
  const { organization } = useOrganization();
  const [status, setStatus] = useState<
    "checking" | "idle" | "connected" | "redirecting" | "error"
  >("checking");
  const [error, setError] = useState<string | null>(null);

  const tenantId = organization?.id;

  useEffect(() => {
    if (!tenantId) {
      setStatus("idle");
      return;
    }
    fetch("/api/integrations/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.vismaNxt) {
          setStatus("connected");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => setStatus("idle"));
  }, [tenantId]);

  const handleConnect = async () => {
    if (!tenantId) {
      setError("Ingen organisasjon funnet. Logg inn på nytt.");
      setStatus("error");
      return;
    }

    setStatus("redirecting");
    setError(null);

    try {
      const res = await fetch(
        `/api/auth/visma-nxt/authorize?tenantId=${encodeURIComponent(tenantId)}`
      );

      if (!res.ok) {
        throw new Error("Kunne ikke starte tilkobling");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt");
      setStatus("error");
    }
  };

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-3">
              <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Visma Business NXT er tilkoblet
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Tilkoblingen er aktiv. Du kan konfigurere synkronisering fra
            innstillinger etter onboarding.
          </p>
        </div>
        <div className="flex justify-center">
          <Button onClick={() => onComplete({ connected: true })} className="gap-2">
            Fortsett
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Koble til Visma Business NXT
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Du blir sendt til Visma Connect for å logge inn og gi Revizo tilgang
          til ditt selskap.
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Sikker tilkobling</p>
              <p className="text-xs text-muted-foreground">
                Revizo bruker OAuth 2.0 for å koble seg til Visma. Du logger inn
                direkte hos Visma — vi ser aldri passordet ditt.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Link2 className="size-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Hva vi får tilgang til</p>
              <p className="text-xs text-muted-foreground">
                Kontoplan, hovedboksposteringer, kunde- og
                leverandørreskontro. Vi henter kun data — vi endrer aldri
                noe i systemet ditt.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          onClick={handleConnect}
          disabled={status === "redirecting"}
          className="w-full gap-2"
        >
          {status === "redirecting" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Kobler til...
            </>
          ) : (
            <>
              <ExternalLink className="size-4" />
              Koble til Visma Connect
            </>
          )}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          Du blir videresendt til connect.visma.com for innlogging.
        </p>

        <div className="text-center pt-2">
          <button
            onClick={() => onComplete({ connected: false })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Hopp over — jeg kobler til senere
          </button>
        </div>
      </div>
    </div>
  );
}
