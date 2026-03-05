"use client";

import { Sparkles, MousePointerClick, MessageCircle, Lightbulb } from "lucide-react";

export function StepSmartPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Smart Panel</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Din AI-drevne assistent som hjelper deg med avstemming, spørsmål og
          daglige oppgaver.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Smart Panel</p>
            <p className="text-xs text-muted-foreground">
              Alltid tilgjengelig, uansett hvor du er i Revizo
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Still spørsmål</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Spør om kontoer, transaksjoner, avstemmingsregler eller
                regnskapsregler.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Få forslag</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                AI-en foreslår matchregler, identifiserer avvik og gir deg
                neste steg.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Høyreklikk hvor som helst</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Høyreklikk på et element for å åpne Smart Panel med kontekst
                fra det du ser på.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual demo area */}
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Prøv det nå</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Høyreklikk hvor som helst på siden for å åpne Smart Panel
          </p>
        </div>
      </div>
    </div>
  );
}
