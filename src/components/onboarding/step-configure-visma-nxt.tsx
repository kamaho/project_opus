"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [status, setStatus] = useState<"idle" | "redirecting" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const tenantId = organization?.id;

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
      setError(
        err instanceof Error ? err.message : "Noe gikk galt"
      );
      setStatus("error");
    }
  };

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
        {/* Info cards */}
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

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* CTA */}
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
      </div>
    </div>
  );
}
