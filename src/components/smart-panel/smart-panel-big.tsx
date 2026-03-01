"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  LayoutDashboard,
  FileText,
  BarChart3,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  FilePlus2,
  type LucideIcon,
} from "lucide-react";
import { PanelSizeToggle } from "./panel-size-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { RevizoIcon, AiAvatar } from "@/components/ui/revizo-icon";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";
import { dispatchSmartPanelAction } from "./smart-panel-mini";
import { TutorialStartButton } from "./tutorial-start-button";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useUser } from "@clerk/nextjs";
import { isSystemAdmin } from "@/lib/auth/is-system-admin";

const TutorialListLazy = dynamic(
  () => import("@/components/tutorial/tutorial-list").then((m) => m.TutorialList),
  { ssr: false }
);

export const BIG_WIDTH = 960;
export const BIG_HEIGHT = 700;

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

interface SmartPanelBigContentProps {
  onClose: () => void;
  onModeChange: (mode: "mini" | "medium" | "big") => void;
  dragHandleProps: DragHandleProps;
}

type SectionId = "overview" | "documents" | "analytics" | "tutorials" | null;

interface SectionCard {
  id: SectionId & string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const SECTIONS: SectionCard[] = [
  { id: "overview", icon: LayoutDashboard, title: "Oversikt", description: "Nøkkeltall og status for aktive avstemminger." },
  { id: "documents", icon: FileText, title: "Dokumenter", description: "Nylige filer og importlogger." },
  { id: "analytics", icon: BarChart3, title: "Analyse", description: "Trender, avvik og matching-statistikk." },
];

// ---------------------------------------------------------------------------
// Mockup data
// ---------------------------------------------------------------------------

const MOCK_KPI = [
  { label: "Totalt matchet", value: "12 847", change: "+342", trend: "up" as const },
  { label: "Umatchede poster", value: "89", change: "-23", trend: "down" as const },
  { label: "Aktive klienter", value: "24", change: "+2", trend: "up" as const },
  { label: "Match-rate", value: "99.3 %", change: "+0.4 %", trend: "up" as const },
];

const MOCK_BAR_DATA = [
  { label: "Jan", value: 62 },
  { label: "Feb", value: 78 },
  { label: "Mar", value: 54 },
  { label: "Apr", value: 91 },
  { label: "Mai", value: 85 },
  { label: "Jun", value: 73 },
  { label: "Jul", value: 96 },
  { label: "Aug", value: 88 },
  { label: "Sep", value: 70 },
  { label: "Okt", value: 82 },
  { label: "Nov", value: 94 },
  { label: "Des", value: 67 },
];

const MOCK_STATUS = [
  { client: "Acme AS", status: "done" as const, count: 2341 },
  { client: "Bergen Regnskap", status: "done" as const, count: 1892 },
  { client: "Fjord Finans", status: "pending" as const, count: 456 },
  { client: "Nordkapp Holding", status: "warning" as const, count: 89 },
  { client: "Tromsø Eiendom", status: "done" as const, count: 3102 },
];

const MOCK_DOCUMENTS = [
  { name: "Banktransaksjoner_Q4_2025.xlsx", type: "import" as const, date: "27. feb 2026", size: "2.4 MB" },
  { name: "Regnskap_Acme_2025.csv", type: "import" as const, date: "25. feb 2026", size: "1.1 MB" },
  { name: "Matching-rapport_Fjord.pdf", type: "report" as const, date: "24. feb 2026", size: "340 KB" },
  { name: "MVA-avstemming_Jan2026.xlsx", type: "import" as const, date: "22. feb 2026", size: "890 KB" },
  { name: "Avviksrapport_Nordkapp.pdf", type: "report" as const, date: "20. feb 2026", size: "210 KB" },
  { name: "Kontoutdrag_DnB_Feb.csv", type: "import" as const, date: "18. feb 2026", size: "3.8 MB" },
  { name: "Smart Match Logg #4821.json", type: "log" as const, date: "17. feb 2026", size: "56 KB" },
];

const MOCK_ANALYTICS_TREND = [35, 42, 38, 55, 48, 62, 58, 71, 65, 78, 85, 92];

const MOCK_MATCH_TYPES = [
  { label: "Eksakt match", pct: 64 },
  { label: "Smart Match", pct: 28 },
  { label: "Manuell", pct: 8 },
];

const MOCK_DEVIATIONS = [
  { client: "Nordkapp Holding", amount: "kr 12 400", severity: "high" as const },
  { client: "Fjord Finans", amount: "kr 3 200", severity: "medium" as const },
  { client: "Tromsø Eiendom", amount: "kr 890", severity: "low" as const },
];

// ---------------------------------------------------------------------------
// Section content components
// ---------------------------------------------------------------------------

function OverviewSection() {
  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        {MOCK_KPI.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-background p-3 space-y-1">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className="text-xl font-semibold font-mono tabular-nums">{kpi.value}</p>
            <div className={cn("flex items-center gap-1 text-xs font-medium", kpi.trend === "up" ? "text-violet-500" : "text-violet-500")}>
              {kpi.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpi.change}
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Matchede poster per måned</p>
        <div className="flex items-end gap-1.5 h-28">
          {MOCK_BAR_DATA.map((bar) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-primary/80 hover:bg-primary transition-colors"
                style={{ height: `${bar.value}%` }}
              />
              <span className="text-[9px] text-muted-foreground/60">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Client status */}
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Klientstatus</p>
        <div className="space-y-2">
          {MOCK_STATUS.map((s) => (
            <div key={s.client} className="flex items-center gap-2.5 text-sm">
              {s.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
              {s.status === "pending" && <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
              {s.status === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
              <span className="flex-1 truncate">{s.client}</span>
              <span className="font-mono tabular-nums text-xs text-muted-foreground">{s.count.toLocaleString("nb-NO")} poster</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsSection() {
  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="flex gap-2">
        <button type="button" className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-muted/40 transition-colors text-sm">
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          Last opp fil
        </button>
        <button type="button" className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-muted/40 transition-colors text-sm">
          <FilePlus2 className="h-3.5 w-3.5 text-muted-foreground" />
          Ny rapport
        </button>
      </div>

      {/* File list */}
      <div className="rounded-lg border bg-background divide-y">
        {MOCK_DOCUMENTS.map((doc) => (
          <button key={doc.name} type="button" className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
            <div className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
              doc.type === "import" ? "bg-blue-500/10 text-blue-500" :
              doc.type === "report" ? "bg-violet-500/10 text-violet-500" :
              "bg-amber-500/10 text-amber-500"
            )}>
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{doc.date}</p>
            </div>
            <span className="text-xs text-muted-foreground/60 shrink-0 font-mono">{doc.size}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnalyticsSection() {
  const maxTrend = Math.max(...MOCK_ANALYTICS_TREND);

  return (
    <div className="space-y-5">
      {/* Sparkline trend */}
      <div className="rounded-lg border bg-background p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Matching-trend (12 mnd)</p>
          <span className="text-xs font-medium text-violet-500 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +163 %
          </span>
        </div>
        <div className="flex items-end gap-1 h-20">
          {MOCK_ANALYTICS_TREND.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-sm bg-primary/60 hover:bg-primary transition-colors"
                style={{ height: `${(val / maxTrend) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted-foreground/50">Mar &apos;25</span>
          <span className="text-[9px] text-muted-foreground/50">Feb &apos;26</span>
        </div>
      </div>

      {/* Match type breakdown */}
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Fordeling matching-type</p>
        <div className="space-y-2.5">
          {MOCK_MATCH_TYPES.map((type) => (
            <div key={type.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{type.label}</span>
                <span className="font-mono tabular-nums text-xs text-muted-foreground">{type.pct} %</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${type.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deviations */}
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Avvik</p>
        <div className="space-y-2">
          {MOCK_DEVIATIONS.map((dev) => (
            <div key={dev.client} className="flex items-center gap-2.5 text-sm">
              <div className={cn(
                "h-2 w-2 rounded-full shrink-0",
                dev.severity === "high" ? "bg-red-500" :
                dev.severity === "medium" ? "bg-amber-500" :
                "bg-violet-500"
              )} />
              <span className="flex-1 truncate">{dev.client}</span>
              <span className="font-mono tabular-nums text-xs text-muted-foreground">{dev.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SmartPanelBigContent({
  onClose,
  onModeChange,
  dragHandleProps,
}: SmartPanelBigContentProps) {
  const pathname = usePathname();
  const tutorial = useTutorialMode();
  const { user } = useUser();
  const _isAdmin = isSystemAdmin(user?.emailAddresses?.[0]?.emailAddress);
  const actions = getActionsForPath(pathname ?? "");
  const [activeSection, setActiveSection] = useState<SectionId>(null);
  const suggestedQuestions = getSuggestedQuestionsForPath(pathname ?? "");

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
    if (isListening && transcript) setQuery(transcript);
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

  const activeSectionData = SECTIONS.find((s) => s.id === activeSection);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5 cursor-grab active:cursor-grabbing shrink-0"
        {...dragHandleProps}
      >
        {activeSection ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 -ml-1"
            onClick={() => setActiveSection(null)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <RevizoIcon size={18} />
        )}
        <span className="text-sm font-medium flex-1 truncate">
          {activeSectionData ? activeSectionData.title : "Revizo Workspace"}
        </span>
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

      {/* Sections area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!activeSection ? (
          <>
            {/* Section cards grid */}
            <div className="grid grid-cols-3 gap-3 p-4">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className="flex flex-col gap-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors text-left group"
                  onClick={() => setActiveSection(section.id as SectionId)}
                >
                  <div className="h-9 w-9 rounded-md bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <section.icon className="h-4.5 w-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{section.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{section.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Welcome / suggested questions */}
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <AiAvatar size={52} className="mb-4" />
                <p className="text-sm font-medium">Hei! Jeg er Revizo.</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[360px]">
                  Still spørsmål om transaksjoner, poster, avstemming eller frister — eller utforsk seksjonene over.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-[500px]">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="text-xs px-3 py-2 rounded-full border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => { if (!isLoading) sendMessage(q); }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages (when conversation is active) */}
            {(messages.length > 0 || isLoading) && (
              <div ref={messagesContainerRef} className="border-t px-4 pt-3 pb-2 space-y-3">
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
                        "rounded-lg px-3 py-2 max-w-[65%] leading-relaxed",
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
                      {msg.suggestedTutorials && msg.suggestedTutorials.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {msg.suggestedTutorials.map((t) => (
                            <TutorialStartButton key={t.id} tutorial={t} />
                          ))}
                        </div>
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
                  <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
                )}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            )}
          </>
        ) : (
          <div className="p-4 animate-in fade-in slide-in-from-right-2 duration-200">
            {activeSection === "overview" && <OverviewSection />}
            {activeSection === "documents" && <DocumentsSection />}
            {activeSection === "analytics" && <AnalyticsSection />}
            {activeSection === "tutorials" && (
              <TutorialListLazy
                isAdmin={_isAdmin}
                onStartPlayback={() => onModeChange("mini")}
                onBack={() => setActiveSection(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* Chat input + toolbar */}
      <div className="border-t shrink-0">
        <form onSubmit={handleSubmit} className="px-4 py-2.5">
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
              placeholder={isListening ? "Lytter…" : "Spør Revizo om hva som helst…"}
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

        {/* Bottom action bar */}
        <div className="border-t px-3 py-1.5 flex items-center gap-1">
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

            <div className="h-5 w-px bg-border shrink-0 mx-0.5" />

            {_isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-7 w-7 shrink-0",
                      tutorial.mode === "recording" ? "text-red-500" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => {
                      if (tutorial.mode === "recording") {
                        tutorial.stopRecording();
                      } else {
                        tutorial.startRecording();
                        onModeChange("mini");
                      }
                    }}
                  >
                    <span className="relative">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {tutorial.mode === "recording" && (
                        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                      )}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {tutorial.mode === "recording" ? "Stopp opptak" : "Opprett tutorial"}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-7 w-7 shrink-0",
                    activeSection === "tutorials" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveSection(activeSection === "tutorials" ? null : "tutorials")}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Se tutorials
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex-1" />

          <span className="text-[10px] text-muted-foreground/40 mr-1">
            Revizo gir ikke regnskapsrådgivning
          </span>
        </div>
      </div>
    </div>
  );
}
