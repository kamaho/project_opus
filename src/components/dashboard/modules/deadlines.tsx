"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Clock, FileQuestion } from "lucide-react";
import type { ModuleProps } from "../types";

const NORWEGIAN_DEADLINES = [
  { id: "mva-1", title: "MVA-melding 1. termin", date: "2026-04-10", recurring: "bimonthly" },
  { id: "mva-2", title: "MVA-melding 2. termin", date: "2026-06-10", recurring: "bimonthly" },
  { id: "mva-3", title: "MVA-melding 3. termin", date: "2026-08-31", recurring: "bimonthly" },
  { id: "mva-4", title: "MVA-melding 4. termin", date: "2026-10-10", recurring: "bimonthly" },
  { id: "mva-5", title: "MVA-melding 5. termin", date: "2026-12-10", recurring: "bimonthly" },
  { id: "mva-6", title: "MVA-melding 6. termin", date: "2027-02-10", recurring: "bimonthly" },
  { id: "aksjonaer", title: "Aksjonærregisteroppgaven", date: "2026-01-31", recurring: "yearly" },
  { id: "arsregnskap", title: "Årsregnskap til Brønnøysund", date: "2026-07-31", recurring: "yearly" },
  { id: "skattemelding-as", title: "Skattemelding AS", date: "2026-05-31", recurring: "yearly" },
  { id: "a-melding", title: "A-melding", date: "2026-03-05", recurring: "monthly" },
];

function daysUntil(dateStr: string) {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function getDeadlineColor(days: number) {
  if (days < 0) return "text-muted-foreground";
  if (days < 7) return "text-red-600";
  if (days < 30) return "text-yellow-600";
  return "text-muted-foreground";
}

function getBadgeStyle(days: number) {
  if (days < 0) return "bg-muted text-muted-foreground";
  if (days < 7) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (days < 30) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
});

export default function Deadlines(_props: ModuleProps) {
  const [showPassed, setShowPassed] = useState(false);

  const sorted = [...NORWEGIAN_DEADLINES]
    .map((d) => ({ ...d, daysLeft: daysUntil(d.date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const filtered = showPassed ? sorted : sorted.filter((d) => d.daysLeft >= 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Frister</CardTitle>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowPassed(!showPassed)}
        >
          {showPassed ? "Skjul passerte" : "Vis passerte"}
        </button>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p className="text-sm">Ingen kommende frister</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className={`h-4 w-4 shrink-0 ${getDeadlineColor(d.daysLeft)}`} />
                  <span className="text-sm truncate">{d.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {dateFormatter.format(new Date(d.date + "T00:00:00"))}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${getBadgeStyle(d.daysLeft)}`}>
                    {d.daysLeft < 0 ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {Math.abs(d.daysLeft)} d siden
                      </span>
                    ) : d.daysLeft === 0 ? (
                      "I dag"
                    ) : (
                      `${d.daysLeft} d`
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
