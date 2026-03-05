"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const USER_TYPES = [
  {
    id: "regnskapsmedarbeider",
    label: "Regnskapsmedarbeider",
    description: "Daglig bokføring og avstemming",
  },
  {
    id: "regnskapsleder",
    label: "Regnskapsleder",
    description: "Leder teamet, har klientansvar",
  },
  {
    id: "leder",
    label: "Leder / Partner",
    description: "Overordnet ansvar og styring",
  },
  {
    id: "revisor",
    label: "Revisor",
    description: "Gjennomgår og attesterer regnskap",
  },
  {
    id: "controller",
    label: "Controller",
    description: "Internkontroll og rapportering",
  },
  {
    id: "annet",
    label: "Annet",
    description: "Annen rolle i organisasjonen",
  },
] as const;

const RESPONSIBILITIES = [
  { id: "bank", label: "Bankavstemming" },
  { id: "mva", label: "MVA" },
  { id: "lonn", label: "Lønn" },
  { id: "arsregnskap", label: "Årsregnskap" },
  { id: "oppgaver", label: "Oppgaver & Frister" },
  { id: "rapporter", label: "Rapporter" },
  { id: "klienter", label: "Klientoversikt" },
  { id: "mobil", label: "Mobilversjon" },
] as const;

export type UserType = (typeof USER_TYPES)[number]["id"];
export type Responsibility = (typeof RESPONSIBILITIES)[number]["id"];

interface StepUserProfileProps {
  initialUserType?: UserType | null;
  initialResponsibilities?: Responsibility[];
  onComplete: (data: {
    userType: UserType;
    responsibilities: Responsibility[];
  }) => void;
}

export function StepUserProfile({
  initialUserType,
  initialResponsibilities = [],
  onComplete,
}: StepUserProfileProps) {
  const [userType, setUserType] = useState<UserType | null>(
    initialUserType ?? null
  );
  const [responsibilities, setResponsibilities] = useState<Set<Responsibility>>(
    new Set(initialResponsibilities)
  );

  function toggleResponsibility(id: Responsibility) {
    setResponsibilities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleContinue() {
    if (!userType) return;
    onComplete({
      userType,
      responsibilities: Array.from(responsibilities),
    });
  }

  return (
    <div className="space-y-8">
      {/* User type */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Hva er din rolle?
          </h2>
          <p className="text-muted-foreground">
            Vi tilpasser Revizo basert på hvordan du jobber.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
          {USER_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setUserType(type.id)}
              className={cn(
                "relative flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all",
                userType === type.id
                  ? "border-foreground bg-foreground/[0.03]"
                  : "border-border hover:border-foreground/20"
              )}
            >
              {userType === type.id && (
                <div className="absolute top-2 right-2">
                  <Check className="h-3.5 w-3.5 text-foreground" />
                </div>
              )}
              <span className="text-sm font-medium">{type.label}</span>
              <span className="text-xs text-muted-foreground">
                {type.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Responsibilities */}
      {userType && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-medium">
              Hva er ansvarsområdene dine?
            </h3>
            <p className="text-sm text-muted-foreground">
              Velg det som er relevant — vi fremhever riktig innhold for deg.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {RESPONSIBILITIES.map((r) => {
              const selected = responsibilities.has(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleResponsibility(r.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/30"
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Continue */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!userType}
          className="gap-2"
        >
          Fortsett
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
