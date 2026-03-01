"use client";

import { FileText, Search, CheckCircle, AlertTriangle, Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  { title: "Forberedelse", desc: "Samle underlag, sjekk kontoplaner og sikre at alle bilag er bokført.", icon: Search },
  { title: "Avstemming", desc: "Avstem MVA-koder mot regnskap og kontroller inngående/utgående.", icon: CheckCircle },
  { title: "Spesialtilfeller", desc: "Håndter omvendt avgiftsplikt, innførsel, uttak og justeringer.", icon: AlertTriangle },
  { title: "Ferdigstilling", desc: "Kontroller oppgaven, godkjenn og send til Altinn.", icon: Send },
];

export default function MvaMeldingPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">MVA-melding</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Komplett arbeidsflyt for MVA-melding — fra forberedelse til innsending.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
