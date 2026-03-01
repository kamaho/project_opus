"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  GripHorizontal,
  Mic,
  X,
  RotateCcw,
  SendHorizonal,
  Search,
  Zap,
  CircleAlert,
  Upload,
  Columns3,
  FileDown,
  Plus,
  Calendar,
  Users,
  GitBranch,
  ArrowUpDown,
  Play,
  Palette,
  User,
  Building2,
  Scale,
  Download,
  GraduationCap,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { isSystemAdmin } from "@/lib/auth/is-system-admin";
import { PanelSizeToggle } from "./panel-size-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { RevizoIcon, AiAvatar } from "@/components/ui/revizo-icon";
import { dispatchSmartPanelAction } from "./smart-panel-mini";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TutorialListLazy = dynamic(
  () => import("@/components/tutorial/tutorial-list").then((m) => m.TutorialList),
  { ssr: false }
);

type MediumView = "chat" | "tutorials";

export const MEDIUM_WIDTH = 480;
export const MEDIUM_HEIGHT = 560;

interface QuickAction {
  id: string;
  icon: LucideIcon;
  label: string;
}

function getActionsForPath(pathname: string): QuickAction[] {
  if (pathname.includes("/matching") && pathname.includes("/clients/")) {
    return [
      { id: "search", icon: Search, label: "Søk i poster" },
      { id: "smart-match", icon: Zap, label: "Smart Match" },
      { id: "unmatched", icon: CircleAlert, label: "Umatchede" },
    ];
  }
  if (pathname.includes("/import") && pathname.includes("/clients/")) {
    return [
      { id: "upload", icon: Upload, label: "Last opp" },
      { id: "columns", icon: Columns3, label: "Kolonner" },
      { id: "import", icon: FileDown, label: "Importer" },
    ];
  }
  if (pathname.includes("/matching-rules")) {
    return [
      { id: "new-rule", icon: Plus, label: "Ny regel" },
      { id: "test", icon: Play, label: "Test" },
      { id: "sort", icon: ArrowUpDown, label: "Prioriter" },
    ];
  }
  if (pathname.includes("/clients") && !pathname.includes("/matching") && !pathname.includes("/import")) {
    return [
      { id: "search", icon: Search, label: "Søk" },
      { id: "new-client", icon: Plus, label: "Ny klient" },
      { id: "deadlines", icon: Calendar, label: "Frister" },
    ];
  }
  if (pathname.includes("/mva-avstemming")) {
    return [
      { id: "period", icon: Calendar, label: "Periode" },
      { id: "compare", icon: Scale, label: "Sammenlign" },
      { id: "export", icon: Download, label: "Eksporter" },
    ];
  }
  if (pathname.includes("/settings")) {
    return [
      { id: "appearance", icon: Palette, label: "Utseende" },
      { id: "profile", icon: User, label: "Profil" },
      { id: "org", icon: Building2, label: "Organisasjon" },
    ];
  }
  return [
    { id: "clients", icon: Users, label: "Klienter" },
    { id: "rules", icon: GitBranch, label: "Regler" },
    { id: "deadlines", icon: Calendar, label: "Frister" },
  ];
}

function getSuggestedQuestionsForPath(pathname: string): string[] {
  if (pathname.includes("/matching") && pathname.includes("/clients/")) {
    return [
      "Hvordan importerer jeg banktransaksjoner?",
      "Hvordan matcher jeg poster manuelt?",
      "Hva er Smart Match og hvordan kjører jeg den?",
      "Hvor ser jeg umatchede poster?",
    ];
  }
  if (pathname.includes("/matching-rules")) {
    return [
      "Hvordan oppretter jeg en matchingregel?",
      "Hva er 1-til-1 vs mange-til-1?",
    ];
  }
  return [
    "Hvilke frister har vi de neste 30 dagene?",
    "Vis umatchede poster for alle klienter",
    "Hvordan importerer jeg banktransaksjoner?",
  ];
}

interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

interface SmartPanelMediumContentProps {
  onClose: () => void;
  onModeChange: (mode: "mini" | "medium") => void;
  onTutorialStart: () => void;
  initialView?: MediumView;
  dragHandleProps: DragHandleProps;
}

export function SmartPanelMediumContent({
  onClose,
  onModeChange,
  onTutorialStart,
  initialView = "chat",
  dragHandleProps,
}: SmartPanelMediumContentProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const isAdmin = isSystemAdmin(user?.emailAddresses?.[0]?.emailAddress);
  const actions = getActionsForPath(pathname ?? "");
  const suggestedQuestions = getSuggestedQuestionsForPath(pathname ?? "");
  const [view, setView] = useState<MediumView>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const [query, setQuery] = useState("");
  const { messages, isLoading, loadingText, isWorking, workingText, error, sendMessage, reset } = useAiChat();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const { isListening, isSupported: voiceSupported, transcript, toggle: toggleVoice } = useVoiceInput((text) => {
    if (text.trim() && !isLoading && !isWorking) {
      setQuery("");
      sendMessage(text.trim());
    }
  });

  useEffect(() => {
    if (isListening && transcript) {
      setQuery(transcript);
    }
  }, [isListening, transcript]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const prev = prevMessageCountRef.current;
    const curr = messages.length;
    prevMessageCountRef.current = curr;

    const lastIsUser = curr > 0 && messages[curr - 1].role === "user";
    const userJustSent = curr > prev && lastIsUser;

    if (userJustSent || (isLoading && curr === prev)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (!text || isLoading || isWorking) return;
    setQuery("");
    sendMessage(text);
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2 cursor-grab active:cursor-grabbing shrink-0"
        {...dragHandleProps}
      >
        <RevizoIcon size={16} />
        <span className="text-sm font-medium flex-1 truncate">Revizo</span>
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <PanelSizeToggle
          expanded
          onClick={() => onModeChange("mini")}
          className="h-6 w-6"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          aria-label="Lukk"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {view === "tutorials" ? (
        <div className="flex-1 min-h-0 animate-in fade-in slide-in-from-right-2 duration-150">
          <TutorialListLazy
            isAdmin={isAdmin}
            onStartPlayback={onTutorialStart}
            onBack={() => setView("chat")}
          />
        </div>
      ) : (
        <>
          {/* Chat area */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-3 min-h-0">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AiAvatar size={48} className="mb-4" />
                <p className="text-sm font-medium">Hei! Jeg er Revizo.</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
                  Din AI-baserte revisor. Spør meg om transaksjoner, avstemming, frister eller hva som helst.
                </p>
                <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[340px]">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="text-xs text-left px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => { if (!isLoading) sendMessage(q); }}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Tutorials shortcut */}
                <button
                  type="button"
                  className="mt-6 w-full max-w-[340px] flex items-center gap-2.5 px-3 py-2.5 rounded-md border bg-muted/20 hover:bg-muted/50 transition-colors group text-left"
                  onClick={() => setView("tutorials")}
                >
                  <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Tutorials</p>
                    <p className="text-[11px] text-muted-foreground">
                      Interaktive guider for denne siden
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                </button>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2.5 text-sm animate-in fade-in slide-in-from-bottom-1 duration-150",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <AiAvatar size={28} className="mt-0.5" />
                )}
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 max-w-[80%] leading-relaxed",
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
            {isLoading && loadingText && (
              <div className="flex gap-2.5 text-sm animate-in fade-in duration-150">
                <AiAvatar size={28} className="mt-0.5 animate-[pulse_2s_ease-in-out_infinite]" />
                <div
                  key={loadingText}
                  className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground italic animate-in fade-in slide-in-from-bottom-1 duration-200"
                >
                  {loadingText}
                </div>
              </div>
            )}
            {isWorking && workingText && (
              <div className="flex gap-2.5 text-sm animate-in fade-in duration-150">
                <AiAvatar size={28} className="mt-0.5 animate-spin-slow" />
                <div
                  key={workingText}
                  className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground italic animate-in fade-in slide-in-from-bottom-1 duration-200"
                >
                  {workingText}
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="border-t px-3 py-2 shrink-0">
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
                placeholder={isListening ? "Lytter…" : "Skriv en melding…"}
                className={cn(
                  "flex-1 h-9 rounded-lg border bg-muted/30 pl-3 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all",
                  isListening && "border-primary/60 ring-2 ring-primary/20"
                )}
              />
              {voiceSupported && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 shrink-0 transition-colors",
                    isListening
                      ? "text-primary animate-pulse"
                      : "text-muted-foreground/40 hover:text-foreground"
                  )}
                  onClick={toggleVoice}
                  disabled={isLoading || isWorking}
                  title={isListening ? "Stopp stemmeinndata" : "Snakk til Revizo"}
                  aria-label={isListening ? "Stopp stemmeinndata" : "Snakk til Revizo"}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className={cn("h-8 w-8 shrink-0", query.trim() ? "text-primary" : "text-muted-foreground/40")}
                disabled={!query.trim() || isLoading || isWorking}
              >
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </>
      )}

      {/* Bottom toolbar */}
      <div className="border-t px-2 py-1.5 shrink-0 flex items-center gap-1">
        <TooltipProvider delayDuration={200}>
          {actions.map((action) => (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => dispatchSmartPanelAction(action.id)}
                >
                  <action.icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {action.label}
              </TooltipContent>
            </Tooltip>
          ))}

        </TooltipProvider>

        <div className="flex-1" />

        <span className="text-[10px] text-muted-foreground/40 mr-1">
          Revizo gir ikke regnskapsrådgivning
        </span>
      </div>
    </div>
  );
}
