"use client";

import { Link2, FileSpreadsheet, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepChoosePathProps {
  onChoose: (path: "integration" | "manual") => void;
}

export function StepChoosePath({ onChoose }: StepChoosePathProps) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Hvordan vil du komme i gang?
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Koble til regnskapssystemet for automatisk synkronisering, eller sett
          opp manuelt med filimport.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Integration path — primary */}
        <button
          type="button"
          onClick={() => onChoose("integration")}
          className={cn(
            "group relative flex flex-col items-start gap-4 rounded-lg border-2 border-foreground/10 p-6 text-left transition-all",
            "hover:border-foreground/30 hover:bg-foreground/[0.02]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
            <Sparkles className="h-2.5 w-2.5" />
            Anbefalt
          </span>

          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-foreground/[0.06]">
            <Link2 className="h-5 w-5" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold">
              Koble til regnskapssystem
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Koble til Tripletex, Visma eller andre systemer for automatisk
              synkronisering av hovedbok og banktransaksjoner.
            </p>
          </div>

          <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors">
            Velg integrasjon
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        {/* Manual path — secondary */}
        <button
          type="button"
          onClick={() => onChoose("manual")}
          className={cn(
            "group flex flex-col items-start gap-4 rounded-lg border border-border p-6 text-left transition-all",
            "hover:border-foreground/20 hover:bg-foreground/[0.01]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
              Sett opp manuelt
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Opprett selskap og avstemminger manuelt. Du kan koble til
              integrasjoner når som helst senere.
            </p>
          </div>

          <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Manuelt oppsett
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>
    </div>
  );
}
