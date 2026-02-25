"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Table2,
  Bot,
  Sparkles,
  LayoutDashboard,
  ListChecks,
  SlidersHorizontal,
  FileText,
  Link2,
  Zap,
  Building2,
  Paintbrush,
  Landmark,
  BrainCircuit,
  Clock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiPreferences } from "@/contexts/ui-preferences-context";
import {
  formatNumber,
  formatDate as fmtDate,
  type NumberFormatPreference,
  type DateFormatPreference,
} from "@/lib/ui-preferences";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SetupWizard, type SetupResult } from "@/components/setup/setup-wizard";

const STEPS = [
  { id: "welcome", label: "Velkommen" },
  { id: "setup", label: "Oppsett" },
  { id: "preferences", label: "Preferanser" },
  { id: "services", label: "Tjenester" },
  { id: "ready", label: "Klar" },
] as const;

export default function OnboardingPage() {
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [enabledServices, setEnabledServices] = useState<Set<string>>(
    () => new Set(["dashboard", "avstemming"])
  );
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();

  function goTo(nextStep: number) {
    setDirection(nextStep > step ? "forward" : "back");
    setStep(nextStep);
  }

  function toggleService(id: string) {
    setEnabledServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleFinish() {
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: Array.from(enabledServices),
        }),
      });
    } finally {
      if (setupResult?.reconciliations?.[0]?.id) {
        router.push(`/dashboard/clients/${setupResult.reconciliations[0].id}/matching`);
      } else {
        router.push("/dashboard");
      }
    }
  }

  if (showIntro) {
    return <IntroAnimation onComplete={() => setShowIntro(false)} />;
  }

  if (!userLoaded) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  const firstName = user?.firstName || "der";

  return (
    <div className={cn(
      "w-full mx-auto",
      step === 3 ? "max-w-3xl" : "max-w-xl"
    )}>
      {/* Progress indicator with back button */}
      <div className="relative flex items-center justify-center mb-12">
        {step > 0 && (
          <button
            onClick={() => goTo(step - 1)}
            className="absolute left-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Tilbake</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "rounded-full transition-all duration-300",
                i === step
                  ? "h-2 w-8 bg-foreground"
                  : i < step
                    ? "h-2 w-2 bg-foreground/30"
                    : "h-2 w-2 bg-border"
              )}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div
        key={step}
        className={cn(
          "animate-in fade-in duration-300",
          direction === "forward"
            ? "slide-in-from-right-4"
            : "slide-in-from-left-4"
        )}
      >
        {step === 0 && <StepWelcome firstName={firstName} onNext={() => goTo(1)} />}
        {step === 1 && (
          <div className="space-y-4">
            <SetupWizard
              mode="fullscreen"
              hideProgress
              onComplete={(result) => {
                setSetupResult(result);
                goTo(2);
              }}
            />
            <div className="text-center">
              <button
                onClick={() => goTo(2)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Hopp over — jeg setter opp avstemming senere
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <StepPreferences onNext={() => goTo(3)} />
        )}
        {step === 3 && (
          <StepServices
            enabledServices={enabledServices}
            onToggle={toggleService}
            onNext={() => goTo(4)}
          />
        )}
        {step === 4 && <StepReady onFinish={handleFinish} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Intro Animation                                                     */
/* ------------------------------------------------------------------ */

function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<
    "initial" | "swap" | "wipe" | "brand" | "done"
  >("initial");
  const containerRef = useRef<HTMLDivElement>(null);

  const advance = useCallback(() => {
    setPhase((p) => {
      switch (p) {
        case "initial": return "swap";
        case "swap":    return "wipe";
        case "wipe":    return "brand";
        case "brand":   return "done";
        default:        return p;
      }
    });
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => advance(), 1500));
    timers.push(setTimeout(() => advance(), 3900));
    timers.push(setTimeout(() => advance(), 4700));
    timers.push(setTimeout(() => advance(), 6400));
    return () => timers.forEach(clearTimeout);
  }, [advance]);

  useEffect(() => {
    if (phase === "done") onComplete();
  }, [phase, onComplete]);

  const showSwapped = phase === "swap" || phase === "wipe" || phase === "brand" || phase === "done";
  const showWipe    = phase === "wipe" || phase === "brand" || phase === "done";
  const showBrand   = phase === "brand" || phase === "done";

  return (
    <div
      ref={containerRef}
      className="intro-easing fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden"
    >
      {/* Text phase */}
      <div
        className="relative text-center w-full"
        style={{ display: showBrand ? "none" : undefined }}
      >
        <div
          className="flex items-center justify-center gap-[0.25em] leading-none"
          style={{
            fontSize: "clamp(2rem, 8vw, 6rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            height: "1.2em",
          }}
        >
          {/* Prefix word */}
          <span
            className="inline-flex relative overflow-hidden items-center"
            style={{ height: "1.2em" }}
          >
            <span
              className={cn("intro-word inline-block", showSwapped && "intro-exit-up")}
            >
              Besøk av
            </span>
            {showSwapped && (
              <span className="intro-word intro-enter-up inline-block absolute left-0">
                klar for
              </span>
            )}
          </span>

          {/* "revisor" */}
          <span
            className="inline-flex relative overflow-hidden items-center"
            style={{ height: "1.2em" }}
          >
            <span className={cn("intro-word inline-block", showWipe && "intro-exit-up")}>
              revisor
            </span>
          </span>

          {/* "?" */}
          <span
            className="inline-flex relative overflow-hidden items-center"
            style={{ height: "1.2em" }}
          >
            <span className={cn("intro-word inline-block", showWipe && "intro-exit-up")}>
              ?
            </span>
          </span>
        </div>
      </div>

      {/* Brand reveal */}
      {showBrand && (
        <div
          className="intro-brand-active absolute left-1/2 top-1/2"
          style={{
            fontSize: "clamp(3rem, 12vw, 10rem)",
            fontWeight: 800,
            letterSpacing: "-0.06em",
            transform: "translate(-50%, -50%)",
          }}
        >
          revizo<span className="text-[oklch(0.72_0.20_155)]">.</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: Welcome                                                       */
/* ------------------------------------------------------------------ */

function StepWelcome({
  firstName,
  onNext,
}: {
  firstName: string;
  onNext: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Velkommen, {firstName}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto mt-3">
          Revizo er et moderne avstemmingsverktøy som gjør regnskapsarbeidet
          enklere, raskere og mer nøyaktig.
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="gap-2">
        Kom i gang
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: Services / Pricing                                            */
/* ------------------------------------------------------------------ */

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: typeof Sparkles;
  included?: boolean;
  comingSoon?: boolean;
  category: "core" | "ai" | "automation" | "enterprise";
}

const SERVICES: ServiceItem[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Oversikt over alle avstemminger, status og nøkkeltall for organisasjonen.",
    price: 0,
    icon: LayoutDashboard,
    included: true,
    category: "core",
  },
  {
    id: "avstemming",
    name: "Avstemmingsmodul",
    description: "Importer transaksjoner fra regnskap og bank, match poster manuelt eller automatisk.",
    price: 499,
    icon: CheckCircle2,
    included: true,
    category: "core",
  },
  {
    id: "smart-panel",
    name: "Smart Panel",
    description: "Kontekstuelt sidepanel med AI-drevne forslag, hurtigsøk og hjelp rett i arbeidsflyten.",
    price: 149,
    icon: Sparkles,
    category: "core",
  },
  {
    id: "matching-regelbygger",
    name: "Matching-regelbygger",
    description: "Bygg avanserte regler for automatisk matching: 1-til-1, mange-til-1, med toleranser og filtre.",
    price: 249,
    icon: SlidersHorizontal,
    category: "core",
  },
  {
    id: "rapportering-balanse",
    name: "Rapporteringsmodul (balanse)",
    description: "Generer balanserapporter, åpne poster-lister og eksporter til PDF/Excel.",
    price: 199,
    icon: FileText,
    category: "core",
  },
  {
    id: "oppgavepanel",
    name: "Oppgavepanel",
    description: "Tildel oppgaver til teammedlemmer, sett frister og følg fremdrift per klient.",
    price: 199,
    icon: ListChecks,
    comingSoon: true,
    category: "core",
  },
  {
    id: "revizo-ai-agent",
    name: "Revizo AI Agent",
    description: "AI-assistent som svarer på spørsmål, analyserer data og gir anbefalinger basert på dine avstemminger.",
    price: 299,
    icon: Bot,
    category: "ai",
  },
  {
    id: "ai-agent-matching",
    name: "AI Agent Matching",
    description: "La AI automatisk matche transaksjoner basert på mønstre, historikk og kontekst — utover regelbasert matching.",
    price: 349,
    icon: BrainCircuit,
    category: "ai",
  },
  {
    id: "ai-agent-rapportering",
    name: "AI Agent Rapportering",
    description: "Automatiske rapporter via nattjobber. AI kjører Smart Match og sender PDF-rapport på e-post etter tidsplan.",
    price: 299,
    icon: Clock,
    category: "ai",
  },
  {
    id: "auto-fil-erp",
    name: "Automatisk filinnhenting fra ERP",
    description: "Koble til regnskapssystemet (Tripletex, PowerOffice, Visma osv.) og hent transaksjoner automatisk.",
    price: 399,
    icon: Zap,
    comingSoon: true,
    category: "automation",
  },
  {
    id: "auto-fil-bank",
    name: "Automatisk filinnhenting fra bank",
    description: "Koble bankkonto direkte og hent transaksjoner automatisk via PSD2/Open Banking.",
    price: 399,
    icon: Landmark,
    comingSoon: true,
    category: "automation",
  },
  {
    id: "bronnoy",
    name: "Kobling mot Brønnøysundregistrene",
    description: "Automatisk oppslag av selskaps- og foretaksdata direkte fra Brønnøysundregistrene.",
    price: 149,
    icon: Building2,
    comingSoon: true,
    category: "automation",
  },
  {
    id: "whitelabel",
    name: "Whitelabel-branding",
    description: "Erstatt Revizo-merkevaren med ditt eget logo, farger og domene. Perfekt for revisorselskap.",
    price: 1499,
    icon: Paintbrush,
    category: "enterprise",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  core: "Kjernemoduler",
  ai: "AI-tjenester",
  automation: "Automatisering",
  enterprise: "Enterprise",
};

function StepServices({
  enabledServices,
  onToggle,
  onNext,
}: {
  enabledServices: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  const monthlyTotal = useMemo(() => {
    return SERVICES.reduce((sum, s) => {
      if (enabledServices.has(s.id) || s.included) return sum + s.price;
      return sum;
    }, 0);
  }, [enabledServices]);

  const categories = ["core", "ai", "automation", "enterprise"] as const;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Velg tjenester</h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Aktiver modulene du trenger. Du kan endre dette når som helst under Innstillinger.
          Alle priser er per organisasjon per måned ekskl. mva.
        </p>
      </div>

      {/* Service categories */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const items = SERVICES.filter((s) => s.category === cat);
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {CATEGORY_LABELS[cat]}
              </h3>
              <div className="space-y-2">
                {items.map((service) => {
                  const isOn = enabledServices.has(service.id) || !!service.included;
                  const Icon = service.icon;
                  return (
                    <div
                      key={service.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        isOn
                          ? "bg-card border-border"
                          : "bg-card/50 border-border/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5",
                        isOn ? "bg-[oklch(0.95_0.04_155)]" : "bg-muted"
                      )}>
                        <Icon className={cn(
                          "h-4.5 w-4.5",
                          isOn ? "text-[oklch(0.55_0.18_155)]" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-medium",
                            !isOn && "text-muted-foreground"
                          )}>
                            {service.name}
                          </span>
                          {service.comingSoon && (
                            <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Kommer snart
                            </span>
                          )}
                          {service.included && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-[oklch(0.95_0.04_155)] px-1.5 py-0.5 text-[10px] font-medium text-[oklch(0.45_0.15_155)]">
                              <Check className="h-2.5 w-2.5" />
                              Inkludert
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {service.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={cn(
                          "text-sm font-mono tabular-nums font-medium",
                          isOn ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {service.price === 0 ? "Gratis" : `${service.price} kr`}
                        </span>
                        {!service.included && (
                          <Switch
                            checked={enabledServices.has(service.id)}
                            onCheckedChange={() => onToggle(service.id)}
                            disabled={!!service.comingSoon}
                            className="scale-90"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky price summary */}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estimert månedskostand</p>
              <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight">
                {monthlyTotal.toLocaleString("nb-NO")} kr
                <span className="text-sm font-normal text-muted-foreground ml-1">/mnd</span>
              </p>
            </div>
            <Button size="lg" onClick={onNext} className="gap-2">
              Neste
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {enabledServices.size} av {SERVICES.filter((s) => !s.comingSoon).length} tilgjengelige tjenester valgt.
            Tjenester merket &laquo;Kommer snart&raquo; faktureres ikke for de er lansert.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: Preferences (table design + Revizo AI combined)               */
/* ------------------------------------------------------------------ */

const NUMBER_FORMAT_OPTIONS: { value: NumberFormatPreference; label: string }[] = [
  { value: "nb", label: "Norsk (1 234,56)" },
  { value: "en", label: "Engelsk (1,234.56)" },
  { value: "ch", label: "Sveitsisk (1'234.56)" },
];

const DATE_FORMAT_OPTIONS: { value: DateFormatPreference; label: string }[] = [
  { value: "nb", label: "Norsk (24.02.2026)" },
  { value: "iso", label: "ISO (2026-02-24)" },
  { value: "us", label: "Amerikansk (02/24/2026)" },
];

const DEMO_TABLE_ROWS = [
  { date: "2026-01-15", desc: "Faktura 1001", amount: 15420.5 },
  { date: "2026-01-16", desc: "Betaling leverandør", amount: -8200 },
  { date: "2026-01-17", desc: "MVA termin 6", amount: 12450.75 },
];

function StepPreferences({
  onNext,
}: {
  onNext: () => void;
}) {
  const {
    preferences,
    updateTablePreferences,
    updateTypographyPreferences,
    updateFormattingPreferences,
  } = useUiPreferences();
  const { table, typography, formatting } = preferences;
  const tableClass = table.visibleDividers
    ? "[&_th]:border-r [&_td]:border-r [&_th]:border-border/80 [&_td]:border-border/80 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0"
    : "";
  const theadClass = table.visibleDividers ? "border-b border-border" : "";
  const rowBorderClass = table.visibleDividers ? "border-t border-border" : "";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Preferanser</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Tilpass hvordan tabeller, tall og datoer vises. Du kan endre dette senere
          under Innstillinger.
        </p>
      </div>

      {/* Table preferences */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Tabellutseende</span>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
          <Label htmlFor="ob-dividers" className="text-sm">
            Synlige skillelinjer
          </Label>
          <Switch
            id="ob-dividers"
            checked={table.visibleDividers}
            onCheckedChange={(checked) =>
              updateTablePreferences({ visibleDividers: checked })
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Tallformat</Label>
            <Select
              value={formatting.numberFormat}
              onValueChange={(v) =>
                updateFormattingPreferences({ numberFormat: v as NumberFormatPreference })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUMBER_FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datoformat</Label>
            <Select
              value={formatting.dateFormat}
              onValueChange={(v) =>
                updateFormattingPreferences({ dateFormat: v as DateFormatPreference })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tekststørrelse</Label>
            <Select
              value={typography.textSize}
              onValueChange={(v) =>
                updateTypographyPreferences({
                  textSize: v as "normal" | "large" | "larger",
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Stor</SelectItem>
                <SelectItem value="larger">Større</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Preview table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <p className="text-xs text-muted-foreground px-3 py-2 border-b bg-muted/50">
          Forhåndsvisning
        </p>
        <div className="overflow-x-auto">
          <table className={cn("w-full text-sm border-collapse", tableClass)}>
            <thead className={theadClass}>
              <tr>
                <th className="text-left font-medium py-2 px-3">Dato</th>
                <th className="text-left font-medium py-2 px-3">Beskrivelse</th>
                <th className="text-right font-medium py-2 px-3 font-mono tabular-nums">
                  Beløp
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO_TABLE_ROWS.map((row, i) => (
                <tr key={i} className={rowBorderClass}>
                  <td className="py-2 px-3">
                    {fmtDate(row.date, formatting.dateFormat)}
                  </td>
                  <td className="py-2 px-3">{row.desc}</td>
                  <td
                    className={cn(
                      "py-2 px-3 text-right font-mono tabular-nums",
                      row.amount < 0 && "text-destructive"
                    )}
                  >
                    {formatNumber(row.amount, formatting.numberFormat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={onNext} className="gap-2">
          Neste
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: Ready                                                         */
/* ------------------------------------------------------------------ */

function StepReady({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Du er klar!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Alt er satt opp. Revizo er klar for deg — last opp dine første filer
          og start avstemmingen.
        </p>
      </div>
      <Button size="lg" onClick={onFinish} className="gap-2">
        Start avstemming
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
