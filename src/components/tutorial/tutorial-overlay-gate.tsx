"use client";

import { useEffect, type ReactNode } from "react";
import { TutorialOverlay } from "./tutorial-overlay";
import { useTutorialMode, type PlaybackStep } from "@/contexts/tutorial-mode-context";

/** Renders the full-screen tutorial overlay and bridges AI chat → tutorial playback. */
export function TutorialOverlayGate({ children }: { children: ReactNode }) {
  const { startPlayback } = useTutorialMode();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        tutorial_id: string;
        tutorial_name: string;
        steps: Array<{
          id: string;
          stepOrder: number;
          elementSelector: string;
          title: string;
          description: string | null;
          pathname: string | null;
          tooltipPosition: string | null;
        }>;
      } | undefined;

      if (!detail?.tutorial_id || !detail?.steps?.length) return;

      const mapped: PlaybackStep[] = detail.steps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        elementSelector: s.elementSelector,
        title: s.title,
        description: s.description,
        pathname: s.pathname,
        tooltipPosition: (s.tooltipPosition as PlaybackStep["tooltipPosition"]) ?? "bottom",
      }));

      startPlayback(detail.tutorial_id, detail.tutorial_name, mapped);
    };

    window.addEventListener("ai-start-tutorial", handler);
    return () => window.removeEventListener("ai-start-tutorial", handler);
  }, [startPlayback]);

  return (
    <>
      <TutorialOverlay />
      {children}
    </>
  );
}
