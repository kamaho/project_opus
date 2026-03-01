"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  Play,
  CheckCircle2,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTutorialMode, type PlaybackStep } from "@/contexts/tutorial-mode-context";

interface TutorialSummary {
  id: string;
  name: string;
  description: string | null;
  stepCount: number;
  completed: boolean;
}

interface TutorialListProps {
  isAdmin: boolean;
  onStartPlayback: () => void;
  onBack?: () => void;
}

export function TutorialList({ isAdmin, onStartPlayback, onBack }: TutorialListProps) {
  const pathname = usePathname();
  const { startPlayback } = useTutorialMode();
  const [tutorials, setTutorials] = useState<TutorialSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTutorials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tutorials?pathname=${encodeURIComponent(pathname)}`);
      if (!res.ok) return;
      const data = await res.json();
      setTutorials(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    fetchTutorials();
  }, [fetchTutorials]);

  const handlePlay = useCallback(
    async (tutorialId: string, name: string) => {
      try {
        const res = await fetch(`/api/tutorials/${tutorialId}`);
        if (!res.ok) return;
        const data = await res.json();
        const steps: PlaybackStep[] = (data.steps ?? []).map(
          (s: Record<string, unknown>) => ({
            id: s.id as string,
            stepOrder: s.stepOrder as number,
            elementSelector: s.elementSelector as string,
            title: s.title as string,
            description: (s.description as string) ?? null,
            pathname: (s.pathname as string) ?? null,
            tooltipPosition: (s.tooltipPosition as "top" | "bottom" | "left" | "right") ?? "bottom",
          })
        );
        if (steps.length === 0) {
          toast.error("Denne tutorialen har ingen steg");
          return;
        }
        startPlayback(tutorialId, name, steps);
        onStartPlayback();
      } catch {
        toast.error("Kunne ikke laste tutorial");
      }
    },
    [startPlayback, onStartPlayback]
  );

  const handleDelete = useCallback(
    async (tutorialId: string) => {
      const res = await fetch(`/api/tutorials/${tutorialId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Kunne ikke slette tutorial");
        return;
      }
      setTutorials((prev) => prev.filter((t) => t.id !== tutorialId));
      toast.success("Tutorial slettet");
    },
    []
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        {onBack && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold flex-1">Tutorials</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Laster tutorials...
          </div>
        ) : tutorials.length === 0 ? (
          <div className="p-6 text-center">
            <GraduationCap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Ingen tutorials for denne siden ennå.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {tutorials.map((t) => (
              <div
                key={t.id}
                className="px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      {t.completed && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/50 mt-1">
                      {t.stepCount} {t.stepCount === 1 ? "steg" : "steg"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => handlePlay(t.id, t.name)}
                    >
                      <Play className="h-3 w-3" />
                      Start
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
