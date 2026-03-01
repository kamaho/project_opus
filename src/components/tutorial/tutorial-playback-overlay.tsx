"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const ELEMENT_FIND_RETRIES = 40;
const ELEMENT_FIND_INTERVAL = 250;

/**
 * Creates a portal container that resists Radix Dialog's `inert` attribute.
 * Uses useState so that creating/removing the portal triggers a re-render.
 */
function useTopPortal(active: boolean) {
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const el = document.createElement("div");
    el.setAttribute("data-tutorial-playback-root", "");
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.zIndex = "2147483647";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    setPortalEl(el);

    const observer = new MutationObserver(() => {
      if (el.hasAttribute("inert")) {
        el.removeAttribute("inert");
      }
      if (el.getAttribute("aria-hidden") === "true") {
        el.removeAttribute("aria-hidden");
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["inert", "aria-hidden"] });

    return () => {
      observer.disconnect();
      el.remove();
      setPortalEl(null);
    };
  }, [active]);

  return portalEl;
}

export function TutorialPlaybackOverlay() {
  const {
    mode,
    playbackSteps,
    currentStepIndex,
    activeTutorialId,
    activeTutorialName,
    nextStep,
    prevStep,
    stopPlayback,
  } = useTutorialMode();

  const isActive = mode === "playing";
  const portalEl = useTopPortal(isActive);

  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [elementFound, setElementFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const rafRef = useRef<number>(0);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const currentStep = playbackSteps[currentStepIndex] ?? null;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === playbackSteps.length - 1;

  const updatePosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      setElementFound(false);
      return;
    }

    const el = document.querySelector(currentStep.elementSelector);
    if (!el) {
      setTargetRect(null);
      setElementFound(false);
      return;
    }

    setElementFound(true);
    setSearching(false);
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [currentStep]);

  const startElementSearch = useCallback(() => {
    if (!currentStep) return;

    setTargetRect(null);
    setElementFound(false);
    setSearching(true);
    cancelAnimationFrame(rafRef.current);
    if (retryRef.current) {
      clearInterval(retryRef.current);
      retryRef.current = null;
    }

    let retryCount = 0;

    const tryFind = () => {
      const el = document.querySelector(currentStep.elementSelector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setElementFound(true);
        setSearching(false);
        if (retryRef.current) {
          clearInterval(retryRef.current);
          retryRef.current = null;
        }
        const tick = () => {
          updatePosition();
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return true;
      }
      return false;
    };

    if (!tryFind()) {
      retryRef.current = setInterval(() => {
        retryCount++;
        if (tryFind() || retryCount >= ELEMENT_FIND_RETRIES) {
          setSearching(false);
          if (retryRef.current) {
            clearInterval(retryRef.current);
            retryRef.current = null;
          }
        }
      }, ELEMENT_FIND_INTERVAL);
    }
  }, [currentStep, updatePosition]);

  useEffect(() => {
    if (mode !== "playing" || !currentStep) return;
    startElementSearch();
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (retryRef.current) {
        clearInterval(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [mode, currentStepIndex, currentStep, startElementSearch, retryTrigger]);

  const handleRetry = useCallback(() => {
    setRetryTrigger((n) => n + 1);
  }, []);

  const handleFinish = useCallback(async () => {
    if (activeTutorialId) {
      fetch(`/api/tutorials/${activeTutorialId}/complete`, { method: "POST" }).catch(() => {});
    }
    stopPlayback();
  }, [activeTutorialId, stopPlayback]);

  if (mode !== "playing" || !currentStep || !portalEl) return null;

  const computeTooltipStyle = (): React.CSSProperties => {
    const ttWidth = 320;
    const ttHeight = 140;

    if (!targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: ttWidth,
      };
    }

    const pos = currentStep.tooltipPosition ?? "bottom";
    let top = 0;
    let left = 0;

    switch (pos) {
      case "bottom":
        top = targetRect.top + targetRect.height + PADDING + 8;
        left = targetRect.left + targetRect.width / 2 - ttWidth / 2;
        break;
      case "top":
        top = targetRect.top - PADDING - 8 - ttHeight;
        left = targetRect.left + targetRect.width / 2 - ttWidth / 2;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - ttHeight / 2;
        left = targetRect.left + targetRect.width + PADDING + 8;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - ttHeight / 2;
        left = targetRect.left - PADDING - 8 - ttWidth;
        break;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - ttWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - ttHeight - 16));

    return { top, left, width: ttWidth };
  };

  const tooltipStyle = computeTooltipStyle();

  const spot = targetRect
    ? {
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        right: targetRect.left + targetRect.width + PADDING,
        bottom: targetRect.top + targetRect.height + PADDING,
      }
    : null;

  const overlayColor = "rgba(0, 0, 0, 0.6)";
  const panelStyle = { pointerEvents: "auto" as const };

  return createPortal(
    <>
      {spot ? (
        <>
          {/* Top */}
          <div
            className="fixed left-0 right-0 top-0 transition-all duration-300 ease-out"
            style={{ ...panelStyle, height: Math.max(0, spot.top), backgroundColor: overlayColor }}
          />
          {/* Bottom */}
          <div
            className="fixed left-0 right-0 bottom-0 transition-all duration-300 ease-out"
            style={{ ...panelStyle, top: spot.bottom, backgroundColor: overlayColor }}
          />
          {/* Left */}
          <div
            className="fixed left-0 transition-all duration-300 ease-out"
            style={{
              ...panelStyle,
              top: spot.top,
              height: spot.bottom - spot.top,
              width: Math.max(0, spot.left),
              backgroundColor: overlayColor,
            }}
          />
          {/* Right */}
          <div
            className="fixed right-0 transition-all duration-300 ease-out"
            style={{
              ...panelStyle,
              top: spot.top,
              height: spot.bottom - spot.top,
              left: spot.right,
              backgroundColor: overlayColor,
            }}
          />
        </>
      ) : (
        <div
          className="fixed inset-0"
          style={{ ...panelStyle, backgroundColor: overlayColor }}
        />
      )}

      {/* Spotlight ring */}
      {spot && (
        <div
          className="fixed pointer-events-none rounded-md ring-2 ring-primary/60 transition-all duration-300 ease-out"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.right - spot.left,
            height: spot.bottom - spot.top,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed bg-popover border rounded-lg shadow-xl p-4 transition-all duration-300 ease-out"
        style={{ pointerEvents: "auto", ...tooltipStyle }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            {activeTutorialName && (
              <p className="text-[11px] text-muted-foreground/60 mb-0.5 truncate">
                {activeTutorialName}
              </p>
            )}
            <h4 className="text-sm font-semibold leading-tight">
              {currentStep.title}
            </h4>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {currentStep.description && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            {currentStep.description}
          </p>
        )}

        {!elementFound && searching && (
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground">
              Leter etter elementet…
            </p>
          </div>
        )}

        {!elementFound && !searching && (
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-amber-500 flex-1">
              Elementet ble ikke funnet på denne siden.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] shrink-0"
              onClick={handleRetry}
            >
              Prøv igjen
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Steg {currentStepIndex + 1} av {playbackSteps.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleFinish}
            >
              Hopp over
            </Button>
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={prevStep}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {isLast ? (
              <Button size="sm" className="h-7 px-3 text-xs" onClick={handleFinish}>
                Ferdig
              </Button>
            ) : (
              <Button size="sm" className="h-7 px-3 text-xs gap-1" onClick={nextStep}>
                Neste
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>,
    portalEl
  );
}
