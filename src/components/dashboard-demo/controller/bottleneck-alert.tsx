"use client";

import { AlertTriangle } from "lucide-react";

export function BottleneckAlert() {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-amber-100 dark:bg-amber-900/40 p-1.5 mt-0.5">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">Kontrollkøen vokser</h4>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
            4 oppgaver i kø. Eldste har ventet i 30 timer.
            1 oppgave har lovpålagt frist som allerede er forfalt. Prioriter denne.
          </p>
        </div>
      </div>
    </div>
  );
}
