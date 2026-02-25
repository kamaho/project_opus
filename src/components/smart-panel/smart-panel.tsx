"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, GripHorizontal, Pin, PinOff, RotateCcw, SendHorizonal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SmartPanelSectionLabel } from "./smart-panel-standard";
import { useAiChat } from "@/hooks/use-ai-chat";

const DEFAULT_WIDTH = 320;

const AGENT_PLACEHOLDERS = [
  "Spør meg om hva som helst…",
  "Hva er differansen mellom mengdene?",
  "Finn poster uten motpost",
  "Forklar denne transaksjonen",
  "Vis alle poster over 100 000",
  "Hjelp meg med avstemming",
];

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
  /** Rendered above footer (e.g. Innstillinger + Design). */
  sectionAboveFooter?: ReactNode;
  footerContent?: ReactNode;
  /** Use same layout as reference: agent input, section labels, Innstillinger, Tips. */
  useStandardLayout?: boolean;
  /** Section heading above main content (e.g. "Om elementet", "Kolonne: Beløp"). */
  contentSectionLabel?: string;
  /** When set, panel can be pinned to stay open across navigation. */
  pinned?: boolean;
  /** Called when user toggles pin. If not provided, pin button is hidden. */
  onPinChange?: (pinned: boolean) => void;
}

const SUGGESTED_QUESTIONS = [
  "Vis umatchede poster for alle klienter",
  "Hvilke frister har vi de neste 30 dagene?",
  "Hvordan importerer jeg banktransaksjoner?",
];

function AgentPlaceholderInput({ onClick }: { onClick: () => void }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % AGENT_PLACEHOLDERS.length);
        setFade(true);
      }, 200);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-3 pt-3 pb-2">
      <div
        className="relative flex items-center cursor-text rounded-lg border bg-muted/30 h-9 px-3 pl-8 hover:border-primary/40 transition-colors"
        onClick={onClick}
      >
        <Sparkles className="absolute left-2.5 h-3.5 w-3.5 text-primary/60" />
        <span
          className={cn(
            "text-sm text-muted-foreground/60 transition-opacity duration-200",
            fade ? "opacity-100" : "opacity-0"
          )}
        >
          {AGENT_PLACEHOLDERS[idx]}
        </span>
      </div>
    </div>
  );
}

function AgentChatView() {
  const [query, setQuery] = useState("");
  const { messages, isLoading, error, sendMessage, reset } = useAiChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (!text || isLoading) return;
    setQuery("");
    sendMessage(text);
  };

  const handleSuggestion = (text: string) => {
    if (isLoading) return;
    sendMessage(text);
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-1 space-y-2.5 max-h-[360px]">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Hei! Jeg er din assistent.</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Still spørsmål om transaksjoner, poster, avstemming eller frister.
            </p>
            <div className="mt-3 flex flex-col gap-1.5 w-full">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="text-xs text-left px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                  onClick={() => handleSuggestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 text-sm animate-in fade-in slide-in-from-bottom-1 duration-150",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-[85%] leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-foreground"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2 text-sm animate-in fade-in duration-150">
            <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2.5 flex gap-1 items-center">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t px-3 py-1">
        <p className="text-[10px] text-muted-foreground/50 leading-tight">
          Revizo AI er en produktassistent. Den gir ikke regnskaps- eller juridisk rådgivning.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="border-t px-3 py-2">
        <div className="relative flex items-center gap-1.5">
          {messages.length > 0 && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-foreground"
              onClick={reset}
              title="Ny samtale"
              aria-label="Ny samtale"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Skriv en melding…"
            className="flex-1 h-9 rounded-lg border bg-muted/30 pl-3 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className={cn("h-8 w-8 shrink-0", query.trim() ? "text-primary" : "text-muted-foreground/40")}
            disabled={!query.trim() || isLoading}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
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
  sectionAboveFooter,
  footerContent,
  useStandardLayout = false,
  contentSectionLabel,
  pinned = false,
  onPinChange,
}: SmartPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const prevPosition = useRef({ x: 0, y: 0 });
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!open) { setChatOpen(false); return; }
    if (position.x === prevPosition.current.x && position.y === prevPosition.current.y) return;
    prevPosition.current = { x: position.x, y: position.y };
    requestAnimationFrame(() => {
      const panelH = panelRef.current?.offsetHeight ?? 300;
      setPos({
        x: Math.max(8, Math.min(position.x, window.innerWidth - DEFAULT_WIDTH - 8)),
        y: Math.max(8, Math.min(position.y, window.innerHeight - panelH - 8)),
      });
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
    const panelW = panelRef.current?.offsetWidth ?? DEFAULT_WIDTH;
    const panelH = panelRef.current?.offsetHeight ?? 200;
    setPos({
      x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - panelW)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - panelH)),
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (chatOpen) { setChatOpen(false); return; }
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, chatOpen]);

  const activeLabel = options.find((o) => o.id === activeOptionId)?.label;
  const showingSubPage = activeOptionId || chatOpen;
  const headerTitle = useStandardLayout
    ? (chatOpen ? "Assistent" : activeOptionId === "design" ? "Design" : activeOptionId ? activeLabel : "Smart panel")
    : (chatOpen ? "Assistent" : activeOptionId ? activeLabel : title);

  return open ? (
    <>
      {/* Overlay with pointer-events: none so the user can click and right-click the page while panel is open. Close via X or Escape. */}
      <div className="fixed inset-0 z-40 pointer-events-none" />
      <div
        ref={panelRef}
        className={cn(
          "fixed z-50 flex flex-col rounded-lg border bg-background shadow-xl",
          dragging && "select-none",
        )}
        style={{ left: pos.x, top: pos.y, width: DEFAULT_WIDTH, maxHeight: "min(85vh, 640px)" }}
      >
        {/* Draggable header */}
        <div
          className="flex items-center gap-2 border-b px-3 py-2 cursor-grab active:cursor-grabbing shrink-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {showingSubPage ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 -ml-1"
              onClick={() => {
                if (chatOpen) setChatOpen(false);
                else onOptionSelect("");
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-medium flex-1 truncate">
            {headerTitle}
          </span>
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          {onPinChange != null && (
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-6 w-6 shrink-0", pinned && "text-primary")}
              onClick={() => onPinChange(!pinned)}
              title={pinned ? "Løsne panel" : "Fest panel (står igjen ved navigering)"}
              aria-label={pinned ? "Løsne panel" : "Fest panel"}
            >
              {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={onClose}
            title="Lukk"
            aria-label="Lukk"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Chat page */}
        {chatOpen && !activeOptionId && <AgentChatView />}

        {/* Standard layout: agent input only in main view (not when drilled into Design etc.) */}
        {useStandardLayout && !chatOpen && !activeOptionId && (
          <>
            <AgentPlaceholderInput onClick={() => setChatOpen(true)} />
            <div className="border-t" />
          </>
        )}

        {/* Main page: agent input + options (non-standard) */}
        {!useStandardLayout && !chatOpen && !activeOptionId && (
          <>
            <AgentPlaceholderInput onClick={() => setChatOpen(true)} />
            {options.length > 0 && <div className="border-t" />}
          </>
        )}

        {/* Content: options list or result */}
        {!chatOpen && (
          <div className="overflow-y-auto min-h-0 flex-1">
            {activeOptionId && resultContent ? (
              /* Sub-view: only the chosen content, no section label */
              resultContent
            ) : !activeOptionId && options.length > 0 ? (
              <div className="py-1">
                {contentSectionLabel && <SmartPanelSectionLabel>{contentSectionLabel}</SmartPanelSectionLabel>}
                <div className={contentSectionLabel ? "py-1" : ""}>
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
              </div>
            ) : resultContent ? (
              contentSectionLabel ? (
                <div>
                  <SmartPanelSectionLabel>{contentSectionLabel}</SmartPanelSectionLabel>
                  <div className="pb-2">{resultContent}</div>
                </div>
              ) : (
                resultContent
              )
            ) : null}
          </div>
        )}

        {/* Innstillinger + Tips only in main view when using standard layout */}
        {!chatOpen && sectionAboveFooter && (!useStandardLayout || !activeOptionId) && (
          <>
            <div className="border-t" />
            <div className="shrink-0">{sectionAboveFooter}</div>
          </>
        )}
        {!chatOpen && footerContent && (!useStandardLayout || !activeOptionId) && (
          <>
            <div className="border-t" />
            <div className="overflow-auto shrink-0">{footerContent}</div>
          </>
        )}
      </div>
    </>
  ) : null;
}
