"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      <p className="text-destructive font-medium">Noe gikk galt</p>
      <p className="text-muted-foreground text-sm text-center max-w-md">
        {error.message}
      </p>
      <Button onClick={reset}>Prøv igjen</Button>
    </div>
  );
}
