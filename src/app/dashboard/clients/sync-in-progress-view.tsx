"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SyncInProgressView() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Klient avstemming</h1>
      <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/10 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-4">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
        <h3 className="text-lg font-medium">Synkroniserer kontoliste og saldoer</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Henter kontodata fra Tripletex. Dette tar vanligvis noen sekunder.
          Siden oppdateres automatisk når data er klart.
        </p>
      </div>
    </div>
  );
}
