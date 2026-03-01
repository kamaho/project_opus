"use client";

import { Users, ClipboardList, Calculator, Landmark, BookOpen, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  { title: "Forberedelse", desc: "Samle timelister, fravær, tillegg og trekk for perioden.", icon: ClipboardList },
  { title: "Beregning", desc: "Kjør lønnsberegning med skatt, feriepenger og ytelser.", icon: Calculator },
  { title: "Arbeidsgiveravgift", desc: "Beregn og kontroller AGA per sone og avgiftsgrunnlag.", icon: Landmark },
  { title: "Bokføring", desc: "Bokfør lønn, skattetrekk, AGA og netto utbetaling.", icon: BookOpen },
  { title: "Avstemming", desc: "Avstem lønnskontoer, skattetrekkskonto og AGA-konto.", icon: CheckCircle },
];

export default function LonnAMeldingPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Users className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Lønnskjøring og A-melding</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Fra forberedelse til ferdig A-melding — alle steg i lønnskjøringen.
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
