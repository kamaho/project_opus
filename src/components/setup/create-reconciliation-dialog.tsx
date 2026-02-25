"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SetupWizard, type SetupResult } from "./setup-wizard";

export function CreateReconciliationDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleComplete(result: SetupResult) {
    setOpen(false);
    if (result.reconciliations?.[0]?.id) {
      router.push(`/dashboard/clients/${result.reconciliations[0].id}/matching`);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        className={cn("rpt-btn")}
        onClick={() => setOpen(true)}
        data-smart-info="Ny avstemming — opprett en ny bankavstemming."
      >
        <div className="rpt-dots" />
        <Plus className="rpt-icon" />
        <span className="rpt-text">Ny avstemming</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opprett avstemming</DialogTitle>
            <DialogDescription>
              Sett opp konsern, selskap og avstemming for å komme i gang.
            </DialogDescription>
          </DialogHeader>
          <SetupWizard
            mode="dialog"
            onComplete={handleComplete}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
