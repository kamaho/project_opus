"use client";

import { ListChecks, ArrowRight } from "lucide-react";

export function MobileTasksTeaser() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[oklch(0.95_0.04_155)] mb-5">
          <ListChecks className="h-8 w-8 text-[oklch(0.55_0.18_155)]" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold">Oppgaver</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Et komplett oppgavepanel for regnskapsteam er under utvikling. Tildel oppgaver,
          sett frister og folg fremdriften — alt samlet i Revizo.
        </p>

        {/* Feature preview cards */}
        <div className="mt-8 space-y-3">
          {[
            { title: "Oppgaveliste", desc: "Tildel og organiser oppgaver per klient" },
            { title: "Frister og paminelser", desc: "Automatiske varsler for kommende frister" },
            { title: "Teamoversikt", desc: "Se hvem som jobber med hva" },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
            </div>
          ))}
        </div>

        {/* Badge */}
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.72_0.20_155)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(0.72_0.20_155)]" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">Kommer snart</span>
        </div>
      </div>
    </div>
  );
}
