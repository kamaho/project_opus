"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 gap-6">
      <div className="flex flex-col items-center gap-3 text-center max-w-md">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>

        <div className="space-y-1.5">
          <p className="font-medium text-foreground">Noe gikk galt</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Det oppstod en uventet feil på denne siden. Feilen er automatisk
            rapportert til teamet.
          </p>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            Feilkode: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={reset}>Prøv igjen</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Gå til dashbordet</Link>
        </Button>
      </div>
    </div>
  );
}
