"use client";

import { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SetupWizard, type SetupResult } from "./setup-wizard";

export interface CreateReconciliationDialogRef {
  open: () => void;
}

interface CreateReconciliationDialogProps {
  /** When true, no trigger button is rendered (use ref.open() or onOpenTrigger from parent) */
  noTrigger?: boolean;
}

export const CreateReconciliationDialog = forwardRef<
  CreateReconciliationDialogRef,
  CreateReconciliationDialogProps
>(function CreateReconciliationDialog({ noTrigger }, ref) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }), []);

  function handleComplete(result: SetupResult) {
    setOpen(false);
    if (result.reconciliations?.[0]?.id) {
      router.push(`/dashboard/clients/${result.reconciliations[0].id}/matching`);
    } else {
      router.refresh();
    }
  }

  const trigger = (
    <button
      type="button"
      className={cn("rpt-btn")}
      onClick={() => setOpen(true)}
      data-smart-info="Ny klient — opprett en ny klient (avstemmingsenhet)."
    >
      <div className="rpt-dots" />
      <Plus className="rpt-icon" />
      <span className="rpt-text">Ny klient</span>
    </button>
  );

  return (
    <>
      {!noTrigger && trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opprett klient</DialogTitle>
            <DialogDescription>
              Sett opp konsern, selskap og klient for å komme i gang.
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
});
