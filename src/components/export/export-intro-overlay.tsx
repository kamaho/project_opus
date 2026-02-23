"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Check, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/components/matching/matching-toolbar";

const MENS_DU_VENTER_QUOTES = [
  "Tallene danser mens du venter.",
  "Snart klar – vi teller for deg.",
  "Rapporten baker i ovnen.",
  "Et øyeblikk, magien skjer.",
  "Dataene samler seg pent.",
] as const;

const AnimatedNumber = dynamic(
  () => import("react-animated-numbers").then((m) => m.default),
  { ssr: false }
);

type ExportOverlayMode = "intro" | "generating";

interface ExportIntroOverlayProps {
  viewMode: ViewMode;
  openCount: number;
  matchedCount: number;
  mode?: ExportOverlayMode;
  showStats?: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const INTRO_DURATION_MS = 1400;

export function ExportIntroOverlay({
  viewMode,
  openCount,
  matchedCount,
  mode = "intro",
  showStats = true,
  onComplete,
  onSkip,
}: ExportIntroOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [checkVisible, setCheckVisible] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isGenerating = mode === "generating";
  const quoteIndexRef = useRef(
    Math.floor(Math.random() * MENS_DU_VENTER_QUOTES.length)
  );
  const quote = MENS_DU_VENTER_QUOTES[quoteIndexRef.current];

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setCheckVisible(true), 500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (isGenerating) return;
    const id = setTimeout(() => onCompleteRef.current(), INTRO_DURATION_MS);
    return () => clearTimeout(id);
  }, [isGenerating]);

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200",
        isGenerating ? "z-[100]" : "z-50"
      )}
      aria-modal
      role="dialog"
      aria-label={isGenerating ? "Lager rapport" : "Forbereder eksport"}
      onClick={(e) => !isGenerating && e.target === e.currentTarget && onSkip()}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-8 rounded-xl border bg-card px-10 py-8 shadow-lg transition-opacity duration-300",
          mounted ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <FileDown className="h-5 w-5 text-primary" />
          </div>
          <span className="text-sm font-medium">
            {isGenerating ? "Lager rapport…" : "Forbereder eksport…"}
          </span>
        </div>

        {showStats && (
          <div className="flex items-center gap-10">
            {viewMode === "open" ? (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Åpne poster</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    <AnimatedNumber
                      animateToNumber={openCount}
                      fontStyle={{ fontSize: "1.5rem" }}
                      transitions={(index) => ({
                        type: "spring",
                        stiffness: 80,
                        damping: 12,
                        mass: 0.5,
                        delay: index * 0.05,
                      })}
                    />
                  </span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Matchgrupper</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    <AnimatedNumber
                      animateToNumber={matchedCount}
                      fontStyle={{ fontSize: "1.5rem" }}
                      transitions={(index) => ({
                        type: "spring",
                        stiffness: 80,
                        damping: 12,
                        mass: 0.5,
                        delay: index * 0.05,
                      })}
                    />
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Lukkede matcher</span>
                <span className="text-2xl font-semibold tabular-nums">
                  <AnimatedNumber
                    animateToNumber={matchedCount}
                    fontStyle={{ fontSize: "1.5rem" }}
                    transitions={(index) => ({
                      type: "spring",
                      stiffness: 80,
                      damping: 12,
                      mass: 0.5,
                      delay: index * 0.05,
                    })}
                  />
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/10 transition-all duration-500",
              checkVisible
                ? "scale-100 opacity-100 shadow-[0_0_20px_rgba(16,185,129,0.5)] ring-4 ring-emerald-400/30"
                : "scale-75 opacity-0"
            )}
            aria-hidden
          >
            <Check
              className={cn(
                "h-6 w-6 text-emerald-600 dark:text-emerald-400 transition-all duration-300",
                checkVisible ? "scale-100 opacity-100" : "scale-50 opacity-0"
              )}
              strokeWidth={2.5}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground max-w-[220px]">
            {quote}
          </p>
        </div>

        {!isGenerating && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onSkip}
          >
            Hopp til formatvalg →
          </Button>
        )}
      </div>
    </div>
  );
}
