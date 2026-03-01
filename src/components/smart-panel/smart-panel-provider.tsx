"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { SmartPanelMiniContent, MINI_WIDTH, MINI_HEIGHT } from "./smart-panel-mini";
import { SmartPanelMediumContent, MEDIUM_WIDTH, MEDIUM_HEIGHT } from "./smart-panel-medium";
import { SmartPanelBigContent, BIG_WIDTH, BIG_HEIGHT } from "./smart-panel-big";

export type PanelMode = "mini" | "medium" | "big";

const PANEL_MODE_KEY = "smart-panel-mode";
const VALID_MODES: PanelMode[] = ["mini", "medium", "big"];

const PANEL_DIMS: Record<PanelMode, { width: number; height: number }> = {
  mini: { width: MINI_WIDTH, height: MINI_HEIGHT },
  medium: { width: MEDIUM_WIDTH, height: MEDIUM_HEIGHT },
  big: { width: BIG_WIDTH, height: BIG_HEIGHT },
};

interface SmartPanelContextValue {
  isGlobalPanelOpen: boolean;
}

const SmartPanelContext = createContext<SmartPanelContextValue>({
  isGlobalPanelOpen: false,
});

export function useGlobalSmartPanel() {
  return useContext(SmartPanelContext);
}

function getElementDescription(target: EventTarget | null): string | null {
  let el = target as HTMLElement | null;

  while (el) {
    const info = el.getAttribute("data-smart-info");
    if (info) return info;
    el = el.parentElement;
  }

  el = target as HTMLElement | null;
  while (el) {
    const tag = el.tagName?.toUpperCase();
    const role = el.getAttribute("role");
    const isInteractive =
      ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(tag) ||
      ["button", "tab", "checkbox", "switch", "link", "menuitem"].includes(role ?? "");

    if (isInteractive) {
      const title = el.getAttribute("title");
      if (title) return title;

      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;

      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 80) {
        if (tag === "BUTTON" || role === "button") return `Knapp: ${text}`;
        if (tag === "A" || role === "link") return `Lenke: ${text}`;
        if (tag === "INPUT") {
          const placeholder = el.getAttribute("placeholder");
          return placeholder ? `Inndatafelt: ${placeholder}` : "Inndatafelt";
        }
        return text;
      }
    }

    el = el.parentElement;
  }

  return null;
}

const TRANSITION_STYLE =
  "width 300ms cubic-bezier(0.4,0,0.2,1), height 300ms cubic-bezier(0.4,0,0.2,1), left 300ms cubic-bezier(0.4,0,0.2,1), top 300ms cubic-bezier(0.4,0,0.2,1), border-radius 200ms ease";

export function SmartPanelProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [panelMode, setPanelMode] = useState<PanelMode>("medium");
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PANEL_MODE_KEY);
      if (stored && VALID_MODES.includes(stored as PanelMode)) {
        setPanelMode(stored as PanelMode);
      } else if (stored === "normal" || stored === "big") {
        setPanelMode("medium");
        localStorage.setItem(PANEL_MODE_KEY, "medium");
      }
    } catch {
      // ignore
    }
  }, []);

  // --- Drag handling ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!panelRef.current) return;
    e.preventDefault();
    setDragging(true);
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dims = PANEL_DIMS[panelMode];
    setPos({
      x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - dims.width)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - dims.height)),
    });
  }, [dragging, panelMode]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  const dragHandleProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };

  // --- Mode switching ---
  const handleModeChange = useCallback((mode: PanelMode) => {
    setPanelMode((prev) => {
      const oldDims = PANEL_DIMS[prev];
      const newDims = PANEL_DIMS[mode];

      const centerX = pos.x + oldDims.width / 2;
      const centerY = pos.y + oldDims.height / 2;

      const newX = Math.max(8, Math.min(centerX - newDims.width / 2, window.innerWidth - newDims.width - 8));
      const newY = Math.max(8, Math.min(centerY - newDims.height / 2, window.innerHeight - newDims.height - 8));

      setPos({ x: newX, y: newY });
      return mode;
    });

    try {
      localStorage.setItem(PANEL_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, [pos]);

  const handleExpandToMedium = useCallback(() => {
    handleModeChange("medium");
  }, [handleModeChange]);

  // --- Open / close ---
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const desc = getElementDescription(e.target);
    void desc; // reserved for future use

    if (typeof window !== "undefined") {
      const storedMode = (localStorage.getItem(PANEL_MODE_KEY) ?? "medium") as PanelMode;
      const mode = VALID_MODES.includes(storedMode) ? storedMode : "medium";
      const dims = PANEL_DIMS[mode];
      setPos({
        x: Math.max(8, (window.innerWidth - dims.width) / 2),
        y: mode === "mini"
          ? Math.max(8, window.innerHeight - dims.height - 32)
          : Math.max(8, (window.innerHeight - dims.height) / 2),
      });
    } else {
      setPos({ x: 0, y: 0 });
    }

    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // --- Escape key ---
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  const dims = PANEL_DIMS[panelMode];

  return (
    <SmartPanelContext.Provider value={{ isGlobalPanelOpen: open }}>
      <div onContextMenuCapture={handleContextMenu} className="contents">
        {children}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40 pointer-events-none" />
          <div
            ref={panelRef}
            className={cn(
              "fixed z-50 rounded-lg border bg-background smart-panel-aura smart-panel-morph overflow-hidden",
              dragging && "select-none",
            )}
            style={{
              left: pos.x,
              top: pos.y,
              width: dims.width,
              height: dims.height,
              transition: dragging ? "none" : TRANSITION_STYLE,
            }}
          >
            <div className="smart-panel-aura-glow" />
            <div
              key={panelMode}
              className="h-full w-full animate-in fade-in duration-150"
            >
              {panelMode === "mini" && (
                <SmartPanelMiniContent
                  onClose={handleClose}
                  onExpandToMedium={handleExpandToMedium}
                  dragHandleProps={dragHandleProps}
                />
              )}
              {panelMode === "medium" && (
                <SmartPanelMediumContent
                  onClose={handleClose}
                  onModeChange={handleModeChange}
                  dragHandleProps={dragHandleProps}
                />
              )}
              {panelMode === "big" && (
                <SmartPanelBigContent
                  onClose={handleClose}
                  onModeChange={handleModeChange}
                  dragHandleProps={dragHandleProps}
                />
              )}
            </div>
          </div>
        </>
      )}
    </SmartPanelContext.Provider>
  );
}
