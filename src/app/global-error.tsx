"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="no">
      <body>
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "system-ui" }}>
          <h2>Noe gikk galt</h2>
          <p style={{ color: "#666", maxWidth: "28rem", margin: "1rem auto" }}>
            En uventet feil oppstod. Feilen er logget og vi jobber med å fikse den.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Prøv igjen
          </button>
        </div>
      </body>
    </html>
  );
}
