"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { X, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";
import { generateSelector } from "@/lib/tutorial/selector-generator";

interface StepFormState {
  selector: string;
  rect: DOMRect;
}

function elementAtPoint(x: number, y: number): Element | null {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (el.closest("[data-tutorial-hint]")) continue;
    if (el.closest("[data-smart-panel]")) continue;
    // Skip the dim overlay and highlight box from this component
    if (el.getAttribute("data-tutorial-dim") !== null) continue;
    if (el.getAttribute("data-tutorial-highlight") !== null) continue;
    return el;
  }
  return null;
}

export function TutorialRecordingOverlay() {
  const { mode, addStep } = useTutorialMode();
  const pathname = usePathname();
  const [formState, setFormState] = useState<StepFormState | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tooltipPos, setTooltipPos] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (mode !== "recording") return;
      if (dialogOpen) return;

      const target = elementAtPoint(e.clientX, e.clientY);
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const selector = generateSelector(target);
      const rect = target.getBoundingClientRect();
      setFormState({ selector, rect });
      setHoveredRect(null);
      setTitle("");
      setDescription("");
      setTooltipPos("bottom");
      setDialogOpen(true);
    },
    [mode, dialogOpen]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (mode !== "recording" || dialogOpen) return;

      const target = elementAtPoint(e.clientX, e.clientY);
      if (!target) { setHoveredRect(null); return; }

      setHoveredRect(target.getBoundingClientRect());
    },
    [mode, dialogOpen]
  );

  useEffect(() => {
    if (mode !== "recording") {
      setFormState(null);
      setHoveredRect(null);
      setDialogOpen(false);
      return;
    }
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("mousemove", handleMouseMove, true);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("mousemove", handleMouseMove, true);
    };
  }, [mode, handleContextMenu, handleMouseMove]);

  const handleSaveStep = useCallback(() => {
    if (!formState || !title.trim()) return;
    addStep({
      elementSelector: formState.selector,
      title: title.trim(),
      description: description.trim(),
      pathname,
      tooltipPosition: tooltipPos,
    });
    setDialogOpen(false);
    setFormState(null);
  }, [formState, title, description, pathname, tooltipPos, addStep]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setFormState(null);
  }, []);

  if (mode !== "recording") return null;

  return (
    <>
      {/* Hover highlight + hint rendered via portal to sit above everything */}
      {createPortal(
        <>
          {!dialogOpen && hoveredRect && (
            <div
              className="fixed pointer-events-none rounded transition-all duration-75"
              style={{
                zIndex: 2147483640,
                top: hoveredRect.top - 3,
                left: hoveredRect.left - 3,
                width: hoveredRect.width + 6,
                height: hoveredRect.height + 6,
                border: "2px dashed oklch(0.65 0.25 250 / 0.5)",
                backgroundColor: "oklch(0.65 0.25 250 / 0.04)",
              }}
            />
          )}

          {!dialogOpen && (
            <div
              data-tutorial-hint=""
              className="fixed top-3 left-1/2 -translate-x-1/2 pointer-events-none"
              style={{ zIndex: 2147483641 }}
            >
              <div className="flex items-center gap-2 bg-popover/95 backdrop-blur border rounded-lg px-3.5 py-2 shadow-lg">
                <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Høyreklikk</strong> pa et element for a legge til steg
                </span>
              </div>
            </div>
          )}

          {/* Highlight box shown while dialog is open */}
          {dialogOpen && formState && (
            <>
              <div
                data-tutorial-dim=""
                className="fixed inset-0"
                style={{ zIndex: 49, backgroundColor: "rgba(0,0,0,0.3)" }}
              />
              <div
                data-tutorial-highlight=""
                className="fixed pointer-events-none rounded-md"
                style={{
                  zIndex: 49,
                  top: formState.rect.top - 4,
                  left: formState.rect.left - 4,
                  width: formState.rect.width + 8,
                  height: formState.rect.height + 8,
                  boxShadow: "0 0 0 3px oklch(0.65 0.25 250 / 0.7)",
                }}
              />
            </>
          )}
        </>,
        document.body
      )}

      {/* Step form as a proper Radix Dialog — gets its own focus scope */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nytt steg</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tittel</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="F.eks. Klikk her for a starte"
                autoFocus
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) handleSaveStep();
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Beskrivelse (valgfritt)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ekstra forklaring..."
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) handleSaveStep();
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Tooltip-posisjon</Label>
              <div className="flex gap-1.5 mt-1">
                {(["top", "bottom", "left", "right"] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setTooltipPos(pos)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      tooltipPos === pos
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border hover:bg-muted/80"
                    }`}
                  >
                    {pos === "top" ? "Over" : pos === "bottom" ? "Under" : pos === "left" ? "Venstre" : "Hoyre"}
                  </button>
                ))}
              </div>
            </div>
            {formState && (
              <div className="text-xs text-muted-foreground font-mono truncate">
                {formState.selector}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Avbryt
              </Button>
              <Button size="sm" onClick={handleSaveStep} disabled={!title.trim()}>
                Lagre steg
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
