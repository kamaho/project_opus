"use client";

import { Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/* DESIGN DEVIATION: Purple gradient + particle animation for Smart Match CTA.
   Reason: Premium AI-powered feature needs distinct visual treatment per user request.
   Approved by: pending */

const PARTICLES = [
  { left: "10%", opacity: 1, dur: 2.35, delay: 0.2 },
  { left: "30%", opacity: 0.7, dur: 2.5, delay: 0.5 },
  { left: "25%", opacity: 0.8, dur: 2.2, delay: 0.1 },
  { left: "44%", opacity: 0.6, dur: 2.05, delay: 0 },
  { left: "50%", opacity: 1, dur: 1.9, delay: 0 },
  { left: "75%", opacity: 0.5, dur: 1.5, delay: 1.5 },
  { left: "88%", opacity: 0.9, dur: 2.2, delay: 0.2 },
  { left: "58%", opacity: 0.8, dur: 2.25, delay: 0.2 },
  { left: "98%", opacity: 0.6, dur: 2.6, delay: 0.1 },
  { left: "65%", opacity: 1, dur: 2.5, delay: 0.2 },
] as const;

interface SmartMatchButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function SmartMatchButton({ onClick, loading, disabled }: SmartMatchButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn("sm-btn group", loading && "sm-btn--loading")}
      onClick={onClick}
      data-smart-info="Smart Match kjører intelligent automatisk matching basert på konfigurerte regler. Viser en forhåndsvisning før noe lagres."
    >
      <span className="sm-btn__fold" />

      <span className="sm-btn__particles" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <i
            key={i}
            className="sm-btn__point"
            style={{
              left: p.left,
              opacity: p.opacity,
              animationDuration: `${p.dur}s`,
              animationDelay: p.delay ? `${p.delay}s` : undefined,
            }}
          />
        ))}
      </span>

      <span className="sm-btn__inner">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5 sm-btn__icon" />
        )}
        {loading ? "Analyserer\u2026" : "Smart Match"}
      </span>
    </button>
  );
}
