"use client";

import { Lock, Check, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { NavItemTier } from "@/lib/constants/navigation";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  requiredTier: NavItemTier;
}

const PRO_BENEFITS = [
  "Ubegrenset klienter og brukere",
  "Alle arbeidsflyter inkl. årsoppgjør og skattemelding",
  "Fagspesifikke sjekklister med veiledning",
  "Rapporter og revisorpakke med PDF",
  "Fristkaskade med varsling",
  "Kapasitetsplanlegging med handlingsforslag",
];

const ENTERPRISE_BENEFITS = [
  "Alt i Pro, pluss:",
  "Integrasjoner med Tripletex, Fiken, Visma m.fl.",
  "AI-assistent med risikovurdering",
  "Dokumentarkiv med versjonskontroll",
  "Revisor- og klientportal",
  "SSO, API-tilgang og SLA",
];

export function UpgradeModal({
  open,
  onOpenChange,
  featureName,
  requiredTier,
}: UpgradeModalProps) {
  const isEnterprise = requiredTier === "ENTERPRISE";
  const tierLabel = isEnterprise ? "Enterprise" : "Pro";
  const benefits = isEnterprise ? ENTERPRISE_BENEFITS : PRO_BENEFITS;
  const price = isEnterprise ? "Tilpasset pris" : "699 kr/bruker/mnd";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <Lock className="size-5 text-muted-foreground" />
          </div>
          <DialogTitle className="text-center">
            {featureName} er en {tierLabel}-funksjon
          </DialogTitle>
          <DialogDescription className="text-center">
            Oppgrader for å låse opp denne og andre avanserte funksjoner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm font-medium">Med {tierLabel} får du:</p>
          <ul className="space-y-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-center text-sm text-muted-foreground">{price}</p>
          <Button className="w-full" size="sm">
            Start 14 dagers gratis prøve
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
          <button
            onClick={() => onOpenChange(false)}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sammenlign planer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
