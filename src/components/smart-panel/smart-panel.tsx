"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, GripHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH = 320;

export interface SmartPanelOption {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  separator?: boolean;
  hint?: string;
}

interface SmartPanelProps {
  open: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  title?: string;
  options: SmartPanelOption[];
  onOptionSelect: (optionId: string) => void;
  activeOptionId: string | null;
  resultContent?: ReactNode;
}

export function SmartPanel({
  open,
  onClose,
  position,
  title = "Smart Panel",
  options,
  onOptionSelect,
  activeOptionId,
  resultContent,
}: SmartPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const prevPosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;
    if (position.x === prevPosition.current.x && position.y === prevPosition.current.y) return;
    prevPosition.current = { x: position.x, y: position.y };
    setPos({
      x: Math.max(8, Math.min(position.x, window.innerWidth - DEFAULT_WIDTH - 8)),
      y: Math.max(8, Math.min(position.y, window.innerHeight - 200)),
    });
  }, [open, position]);

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
    setPos({
      x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 100)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 60)),
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const activeLabel = options.find((o) => o.id === activeOptionId)?.label;

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-50 flex flex-col rounded-lg border bg-background shadow-xl",
        dragging && "select-none",
      )}
      style={{ left: pos.x, top: pos.y, width: DEFAULT_WIDTH }}
    >
      {/* Draggable header */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {activeOptionId ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 -ml-1"
            onClick={() => onOptionSelect("")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
        )}
        <span className="text-sm font-medium flex-1 truncate">
          {activeOptionId ? activeLabel : title}
        </span>
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content: options list or result */}
      <div className="overflow-auto">
        {activeOptionId && resultContent ? (
          resultContent
        ) : options.length > 0 ? (
          <div className="py-1">
            {options.map((opt) => (
              <div key={opt.id}>
                {opt.separator && <div className="my-1 border-t" />}
                <button
                  type="button"
                  disabled={opt.disabled}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                    opt.disabled
                      ? "text-muted-foreground/50 cursor-not-allowed"
                      : "hover:bg-muted/60"
                  )}
                  onClick={() => !opt.disabled && onOptionSelect(opt.id)}
                >
                  {opt.icon && <span className="shrink-0 text-muted-foreground">{opt.icon}</span>}
                  <span className="flex-1">{opt.label}</span>
                  {opt.hint && <span className="text-xs text-muted-foreground/60 shrink-0">{opt.hint}</span>}
                </button>
              </div>
            ))}
          </div>
        ) : resultContent ? (
          resultContent
        ) : null}
      </div>
    </div>
  );
}
