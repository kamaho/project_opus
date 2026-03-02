"use client";

import { Building2, ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateReconciliationDialog } from "@/components/setup/create-reconciliation-dialog";

interface DashboardEmptyProps {
  step: "org" | "company" | "reconciliation";
  orgSlug?: string | null;
}

export function DashboardEmpty({ step, orgSlug }: DashboardEmptyProps) {
  if (step === "org") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">Opprett en organisasjon</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          For å komme i gang trenger du en organisasjon. Bruk organisasjonsvelgeren
          øverst til venstre for å opprette en ny.
        </p>
      </div>
    );
  }

  if (step === "company") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">Opprett ditt første selskap</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {orgSlug ? (
            <>
              Du er logget inn som <span className="font-medium text-foreground">{orgSlug}</span>.{" "}
            </>
          ) : null}
          Opprett et konsern og selskap for å begynne med avstemming.
        </p>
        <div className="mt-6">
          <CreateReconciliationDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Wallet className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">Opprett din første avstemming</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Du har selskap, men ingen avstemminger ennå. Opprett en avstemming
        for å begynne med matching av transaksjoner.
      </p>
      <div className="mt-6">
        <CreateReconciliationDialog />
      </div>
    </div>
  );
}
