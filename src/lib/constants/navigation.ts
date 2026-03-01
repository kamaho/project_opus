import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  UserCog,
  CalendarCheck,
  FileText,
  Banknote,
  BookOpen,
  Calculator,
  Landmark,
  BarChart3,
  Package,
  FolderOpen,
  Plug,
  Sparkles,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItemTier = "STARTER" | "PRO" | "ENTERPRISE";
export type NavItemStatus = "ACTIVE" | "COMING_SOON" | "LOCKED";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  tier: NavItemTier;
  status: NavItemStatus;
  badge?: string;
  smartInfo: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: "OVERSIKT",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Dashboard — oversikt over klienter, status og snarveier.",
      },
      {
        id: "clients",
        label: "Klienter",
        icon: Users,
        href: "/dashboard/clients",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Klienter — administrer klienter og deres avstemminger.",
      },
      {
        id: "tasks",
        label: "Oppgaver",
        icon: CheckSquare,
        href: "/dashboard/oppgaver",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Oppgaver — kanban-tavle og oppgaveliste med filtrering.",
      },
      {
        id: "calendar",
        label: "Kalender",
        icon: Calendar,
        href: "/dashboard/kalender",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Kalender — frist-kalender med lovpålagte og interne frister.",
      },
      {
        id: "team",
        label: "Team",
        icon: UserCog,
        href: "/dashboard/team",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Team — teamoversikt med kapasitetsvisning.",
        // TODO: role-gate — kun synlig for MANAGER/ADMIN
      },
    ],
  },
  {
    label: "ARBEIDSFLYTER",
    items: [
      {
        id: "monthly-closing",
        label: "Månedlig avslutning",
        icon: CalendarCheck,
        href: "/dashboard/manedlig-avslutning",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Månedlig avslutning — bankavstemming, kundefordringer, leverandørgjeld, periodiseringer, lønn, MVA.",
      },
      {
        id: "vat-return",
        label: "MVA-melding",
        icon: FileText,
        href: "/dashboard/mva-melding",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "MVA-melding — forberedelse, avstemming, spesialtilfeller, ferdigstilling.",
      },
      {
        id: "payroll",
        label: "Lønn & A-melding",
        icon: Banknote,
        href: "/dashboard/lonn-a-melding",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Lønnskjøring og A-melding — forberedelse, beregning, AGA, bokføring, avstemming.",
      },
      {
        id: "annual-closing",
        label: "Årsoppgjør",
        icon: BookOpen,
        href: "/dashboard/arsoppgjor",
        tier: "PRO",
        status: "COMING_SOON",
        badge: "Snart",
        smartInfo: "Årsoppgjør — hele balansen, resultat, skattemelding, noter, revisorforberedelse.",
      },
      {
        id: "tax-return",
        label: "Skattemelding næring",
        icon: Calculator,
        href: "/dashboard/skattemelding-naering",
        tier: "PRO",
        status: "COMING_SOON",
        badge: "Snart",
        smartInfo: "Skattemelding næring — midlertidige/permanente forskjeller, næringsoppgave.",
      },
      {
        id: "shareholder",
        label: "Aksjonærregister",
        icon: Landmark,
        href: "/dashboard/aksjonaerregister",
        tier: "PRO",
        status: "COMING_SOON",
        badge: "Snart",
        smartInfo: "Aksjonærregisteroppgave — aksjekapital, utbytte, kapitalendringer.",
      },
    ],
  },
  {
    label: "VERKTØY",
    items: [
      {
        id: "reports",
        label: "Rapporter",
        icon: BarChart3,
        href: "/dashboard/rapporter",
        tier: "PRO",
        status: "LOCKED",
        smartInfo: "Rapporter — fristoverholdelse, produktivitet, kvalitetskontroll, kapasitet.",
      },
      {
        id: "auditor-package",
        label: "Revisorpakke",
        icon: Package,
        href: "/dashboard/revisorpakke",
        tier: "PRO",
        status: "LOCKED",
        smartInfo: "Revisorpakke — samlet revisor-klargjøring per klient med PDF.",
      },
      {
        id: "documents",
        label: "Dokumentarkiv",
        icon: FolderOpen,
        href: "/dashboard/dokumentarkiv",
        tier: "ENTERPRISE",
        status: "LOCKED",
        smartInfo: "Dokumentarkiv — sentralt filarkiv per klient med versjonskontroll.",
      },
      {
        id: "integrations",
        label: "Integrasjoner",
        icon: Plug,
        href: "/dashboard/integrasjoner",
        tier: "STARTER",
        status: "ACTIVE",
        smartInfo: "Integrasjoner — Tripletex, Visma, Xledger, Business Central, SFTP, Open Banking m.m.",
      },
      {
        id: "ai-assistant",
        label: "AI-assistent",
        icon: Sparkles,
        href: "/dashboard/ai",
        tier: "ENTERPRISE",
        status: "LOCKED",
        smartInfo: "AI-assistent — risikovurdering, feildeteksjon, smart oppgavefordeling.",
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  id: "settings",
  label: "Innstillinger",
  icon: Settings,
  href: "/dashboard/settings",
  tier: "STARTER",
  status: "ACTIVE",
  smartInfo: "Innstillinger — konfigurer profil, organisasjon og systemvalg.",
};

export const TIER_LABELS: Record<NavItemTier, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Ent.",
};

export const TIER_ORDER: Record<NavItemTier, number> = {
  STARTER: 0,
  PRO: 1,
  ENTERPRISE: 2,
};
