"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, GripHorizontal, Pin, PinOff, RotateCcw, SendHorizonal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SmartPanelSectionLabel } from "./smart-panel-standard";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const DEFAULT_WIDTH = 320;
const TUTORIAL_WIDTH = 420;
const TUTORIAL_MAX_HEIGHT = 300;

/** Forslag til spørsmål basert på hvilken side brukeren er på. */
function getSuggestedQuestionsForPath(pathname: string): string[] {
  if (pathname.includes("/matching") && pathname.includes("/clients/")) {
    return [
      "Hvordan importerer jeg banktransaksjoner?",
      "Hvordan matcher jeg poster manuelt?",
      "Hva er Smart Match og hvordan kjører jeg den?",
      "Hvor ser jeg umatchede poster?",
    ];
  }
  if (pathname.includes("/import") && pathname.includes("/clients/")) {
    return [
      "Hvilke filformater kan jeg importere?",
      "Hvordan importerer jeg fra Excel?",
      "Hva er Mengde 1 og Mengde 2?",
    ];
  }
  if (pathname.includes("/matching-rules")) {
    return [
      "Hvordan oppretter jeg en matchingregel?",
      "Hva er 1-til-1 vs mange-til-1?",
      "Hvordan prioriterer jeg regler?",
    ];
  }
  if (pathname.includes("/clients") && !pathname.includes("/matching") && !pathname.includes("/import")) {
    return [
      "Hvordan oppretter jeg en ny klient?",
      "Hvordan importerer jeg transaksjoner?",
      "Hvilke frister har vi de neste 30 dagene?",
    ];
  }
  if (pathname.includes("mva-avstemming")) {
    return [
      "Hva er MVA-avstemming?",
      "Hvilke frister gjelder for MVA-melding?",
      "Hvordan kobler jeg MVA til en klient?",
    ];
  }
  if (pathname.includes("settings")) {
    return [
      "Hvordan endrer jeg tallformat og datoformat?",
      "Hvordan inviterer jeg flere brukere?",
    ];
  }
  return [
    "Hvilke frister har vi de neste 30 dagene?",
    "Vis umatchede poster for alle klienter",
    "Hvordan importerer jeg banktransaksjoner?",
  ];
}

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

/** Stjerne-ikon for smart søk (ingen forstørrelsesglass, ingen filterknapp). */
function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.5 6C11.3949 6.00006 11.2925 5.96705 11.2073 5.90565C11.1221 5.84425 11.0583 5.75758 11.0251 5.65792L10.7623 4.86908C10.6623 4.57101 10.4288 4.33629 10.13 4.23693L9.34102 3.97354C9.24166 3.94019 9.1553 3.87649 9.09411 3.79142C9.03292 3.70635 9 3.60421 9 3.49943C9 3.39465 9.03292 3.29252 9.09411 3.20745C9.1553 3.12238 9.24166 3.05867 9.34102 3.02532L10.13 2.76193C10.4282 2.66191 10.663 2.42852 10.7623 2.12979L11.0258 1.34094C11.0591 1.24161 11.1229 1.15526 11.2079 1.09409C11.293 1.03291 11.3952 1 11.5 1C11.6048 1 11.707 1.03291 11.7921 1.09409C11.8771 1.15526 11.9409 1.24161 11.9742 1.34094L12.2377 2.12979C12.2868 2.27697 12.3695 2.4107 12.4792 2.52041C12.589 2.63013 12.7227 2.71281 12.87 2.76193L13.659 3.02532C13.7583 3.05867 13.8447 3.12238 13.9059 3.20745C13.9671 3.29252 14 3.39465 14 3.49943C14 3.60421 13.9671 3.70635 13.9059 3.79142C13.8447 3.87649 13.7583 3.94019 13.659 3.97354L12.87 4.23693C12.5718 4.33696 12.337 4.57034 12.2377 4.86908L11.9742 5.65792C11.9411 5.75747 11.8774 5.84406 11.7923 5.90545C11.7072 5.96684 11.6049 5.99992 11.5 6Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 13C5.85133 13.0001 5.7069 12.9504 5.58969 12.859C5.47247 12.7675 5.38921 12.6395 5.35313 12.4952L5.12388 11.5745C4.91418 10.7391 4.26198 10.0868 3.42674 9.87703L2.50619 9.64774C2.36169 9.61194 2.23333 9.52878 2.14159 9.41151C2.04985 9.29425 2 9.14964 2 9.00075C2 8.85185 2.04985 8.70724 2.14159 8.58998C2.23333 8.47272 2.36169 8.38955 2.50619 8.35376L3.42674 8.12446C4.26198 7.91473 4.91418 7.2624 5.12388 6.427L5.35313 5.50629C5.38892 5.36176 5.47207 5.23338 5.58931 5.14162C5.70655 5.04986 5.85113 5 6 5C6.14887 5 6.29345 5.04986 6.41069 5.14162C6.52793 5.23338 6.61108 5.36176 6.64687 5.50629L6.87612 6.427C6.97865 6.83721 7.19071 7.21184 7.48965 7.51082C7.78858 7.80981 8.16313 8.02192 8.57326 8.12446L9.49381 8.35376C9.63831 8.38955 9.76667 8.47272 9.85841 8.58998C9.95015 8.70724 10 8.85185 10 9.00075C10 9.14964 9.95015 9.29425 9.85841 9.41151C9.76667 9.52878 9.63831 9.61194 9.49381 9.64774L8.57326 9.87703C8.16313 9.97957 7.78858 10.1917 7.48965 10.4907C7.19071 10.7897 6.97865 11.1643 6.87612 11.5745L6.64687 12.4952C6.61079 12.6395 6.52753 12.7675 6.41031 12.859C6.2931 12.9504 6.14867 13.0001 6 13Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5005 23C13.3376 23 13.1791 22.9469 13.049 22.8487C12.9189 22.7505 12.8243 22.6127 12.7795 22.456L11.9665 19.61C11.7915 18.9971 11.4631 18.4389 11.0124 17.9882C10.5616 17.5374 10.0035 17.209 9.39054 17.034L6.54454 16.221C6.38795 16.1761 6.25021 16.0815 6.15216 15.9514C6.05411 15.8214 6.00108 15.6629 6.00108 15.5C6.00108 15.3371 6.05411 15.1786 6.15216 15.0486C6.25021 14.9185 6.38795 14.8239 6.54454 14.779L9.39054 13.966C10.0035 13.791 10.5616 13.4626 11.0124 13.0118C11.4631 12.5611 11.7915 12.0029 11.9665 11.39L12.7795 8.544C12.8244 8.38741 12.919 8.24967 13.0491 8.15162C13.1792 8.05357 13.3376 8.00054 13.5005 8.00054C13.6634 8.00054 13.8219 8.05357 13.952 8.15162C14.0821 8.24967 14.1767 8.38741 14.2215 8.544L15.0345 11.39C15.2096 12.0029 15.538 12.5611 15.9887 13.0118C16.4394 13.4626 16.9976 13.791 17.6105 13.966L20.4565 14.779C20.6131 14.8239 20.7509 14.9185 20.8489 15.0486C20.947 15.1786 21 15.3371 21 15.5C21 15.6629 20.947 15.8214 20.8489 15.9514C20.7509 16.0815 20.6131 16.1761 20.4565 16.221L17.6105 17.034C16.9976 17.209 16.4394 17.5374 15.9887 17.9882C15.538 18.4389 15.2096 18.9971 15.0345 19.61L14.2215 22.456C14.1768 22.6127 14.0822 22.7505 13.9521 22.8487C13.822 22.9469 13.6635 23 13.5005 23Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
        className="group relative flex items-center cursor-text rounded-lg border bg-muted/30 h-9 px-3 pl-8 hover:border-primary/40 transition-colors"
        onClick={onClick}
      >
        <StarIcon className="absolute left-2.5 h-4 w-4 text-muted-foreground/60 group-hover:text-primary/60 transition-colors [@media(hover:hover)]:group-hover:scale-110 transition-transform" />
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
  const pathname = usePathname();
  const suggestedQuestions = getSuggestedQuestionsForPath(pathname ?? "");
  const { messages, isLoading, error, sendMessage, reset } = useAiChat();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
              {suggestedQuestions.map((q) => (
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
                "rounded-lg px-3 py-2 max-w-[85%] leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                  : "bg-muted/60 text-foreground [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:font-semibold [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
              )}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
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
        <div aria-hidden="true" />
      </div>
      <div className="border-t px-3 py-1">
        <p className="text-[10px] text-muted-foreground/50 leading-tight">
          Reviz er en produktassistent. Den gir ikke regnskaps- eller juridisk rådgivning.
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
  title = "Smarte funksjonaliteter",
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

  const { enabled: tutorialMode } = useTutorialMode();
  const effectiveWidth = tutorialMode ? TUTORIAL_WIDTH : DEFAULT_WIDTH;
  const effectiveMaxHeight = tutorialMode ? TUTORIAL_MAX_HEIGHT : "min(85vh, 640px)";

  useEffect(() => {
    if (!open) { setChatOpen(false); return; }
    if (position.x === prevPosition.current.x && position.y === prevPosition.current.y) return;
    prevPosition.current = { x: position.x, y: position.y };
    requestAnimationFrame(() => {
      const panelH = panelRef.current?.offsetHeight ?? 300;
      setPos({
        x: Math.max(8, Math.min(position.x, window.innerWidth - effectiveWidth - 8)),
        y: Math.max(8, Math.min(position.y, window.innerHeight - panelH - 8)),
      });
    });
  }, [open, position, effectiveWidth]);

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
    ? (chatOpen ? "Assistent" : activeOptionId === "design" ? "Design" : tutorialMode ? "Tutorial" : activeOptionId ? activeLabel : "Smarte funksjonaliteter")
    : (chatOpen ? "Assistent" : activeOptionId ? activeLabel : tutorialMode ? "Tutorial" : title);

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
        style={{ left: pos.x, top: pos.y, width: effectiveWidth, maxHeight: effectiveMaxHeight }}
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

        {/* Standard layout: agent input only in main view (not in tutorial mode or Design etc.) */}
        {useStandardLayout && !chatOpen && !activeOptionId && !tutorialMode && (
          <>
            <AgentPlaceholderInput onClick={() => setChatOpen(true)} />
            <div className="border-t" />
          </>
        )}

        {/* Main page: agent input + options (non-standard) */}
        {!useStandardLayout && !chatOpen && !activeOptionId && !tutorialMode && (
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
