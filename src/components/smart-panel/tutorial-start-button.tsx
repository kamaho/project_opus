"use client";

import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import type { SuggestedTutorial } from "@/hooks/use-ai-chat";

async function fetchAndStartTutorial(tutorialId: string) {
  const res = await fetch(`/api/tutorials/${tutorialId}`);
  if (!res.ok) throw new Error("Kunne ikke hente tutorial");

  const data = await res.json();
  const steps = data.steps as Array<{
    id: string;
    stepOrder: number;
    elementSelector: string;
    title: string;
    description: string | null;
    pathname: string | null;
    tooltipPosition: string | null;
  }>;

  if (!steps?.length) throw new Error("Tutorialen har ingen steg");

  window.dispatchEvent(
    new CustomEvent("ai-start-tutorial", {
      detail: {
        tutorial_id: data.id ?? tutorialId,
        tutorial_name: data.name ?? "Tutorial",
        steps,
      },
    })
  );
}

export function TutorialStartButton({ tutorial }: { tutorial: SuggestedTutorial }) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const handleClick = async () => {
    if (loading || started) return;
    setLoading(true);
    try {
      await fetchAndStartTutorial(tutorial.id);
      setStarted(true);
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || started}
      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border border-border/60 bg-background hover:bg-muted/60 transition-colors text-sm disabled:opacity-50 disabled:cursor-default"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">
        {started ? "Tutorial startet" : `Start: ${tutorial.name}`}
      </span>
    </button>
  );
}
