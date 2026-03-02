"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

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
      <body
        style={{
          margin: 0,
          fontFamily:
            "var(--font-geist-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
          background: "#0a0a0a",
          color: "#fafafa",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "480px",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
              Revizo
            </span>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#4ade80",
                display: "inline-block",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 500,
                color: "#fafafa",
              }}
            >
              Noe gikk galt
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "#a1a1aa",
                lineHeight: 1.6,
              }}
            >
              Det oppstod en uventet feil. Prøv å laste siden på nytt.
              Feilen er automatisk rapportert.
            </p>
          </div>

          {error.digest && (
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#52525b",
                fontFamily: "var(--font-geist-mono, monospace)",
              }}
            >
              Feilkode: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#fafafa",
                color: "#0a0a0a",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Prøv igjen
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1.25rem",
                background: "transparent",
                color: "#a1a1aa",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Gå til forsiden
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
