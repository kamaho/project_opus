"use client";

import { BookOpen, Check, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  "180+ fagspesifikke sjekklistepunkter",
  "Hele balansen kontoklasse for kontoklasse",
  "Skatteberegning og utsatt skatt",
  "Komplett notesett med alle påkrevde noter",
  "Automatisk revisorpakke-generering",
];

export default function ArsoppgjorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Badge variant="secondary" className="mb-4">
        Kommer snart
      </Badge>

      <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-muted">
        <BookOpen className="size-7 text-muted-foreground" />
      </div>

      <h1 className="text-2xl font-semibold">Årsoppgjør</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Komplett kvalitetssikring av årsoppgjøret — fra balansegjennomgang til revisorpakke.
        Alt du trenger for en trygg og effektiv årsavslutning.
      </p>

      <div className="mt-8 text-left max-w-sm w-full space-y-3">
        <p className="text-sm font-medium">Det som kommer:</p>
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Forventet lansering: Q3 2026
      </p>

      <Button variant="outline" size="sm" className="mt-4 gap-1.5">
        <Bell className="size-3.5" />
        Gi meg beskjed når det er klart
      </Button>
    </div>
  );
}
