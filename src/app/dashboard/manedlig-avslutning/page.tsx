"use client";

import { CalendarCheck, Building2, CreditCard, Users, Clock, Receipt, Landmark } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  { title: "Bankavstemming", desc: "Avstem bankkontoer mot reskontro og identifiser differanser.", icon: CreditCard },
  { title: "Kundefordringer", desc: "Gjennomgå aldersfordeling, purringer og avsetning for tap.", icon: Users },
  { title: "Leverandørgjeld", desc: "Avstem leverandørsaldo, periodiser utgifter og kontroller faktura.", icon: Building2 },
  { title: "Periodiseringer", desc: "Bokfør forskuddsbetalte kostnader og påløpte inntekter/utgifter.", icon: Clock },
  { title: "Lønn", desc: "Avstem lønnskostnader, feriepenger, arbeidsgiveravgift og skattetrekk.", icon: Landmark },
  { title: "MVA", desc: "Kontroller MVA-oppgave mot regnskap og korriger avvik.", icon: Receipt },
];

export default function ManedligAvslutningPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Månedlig avslutning</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Sjekkliste og arbeidsflyt for periodeslutt. Fullført alle steg for en trygg månedlig avslutning.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Card key={s.title} className="opacity-60 cursor-default">
            <CardHeader>
              <div className="flex items-center gap-2">
                <s.icon className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{s.title}</CardTitle>
              </div>
              <CardDescription>{s.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Kommer snart — denne modulen er under utvikling.</p>
    </div>
  );
}
