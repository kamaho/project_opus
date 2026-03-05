"use client";

import { useState, useMemo } from "react";
import {
  Plug,
  Search,
  Settings2,
  CreditCard,
  Server,
  Globe,
  FileSpreadsheet,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TripletexConfigDialog } from "@/components/settings/tripletex-config-dialog";
import { VismaNxtConfigDialog } from "@/components/settings/visma-nxt-config-dialog";

type Category = "all" | "accounting" | "erp" | "bank" | "transfer" | "other";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: Category;
  logoElement: React.ReactNode;
  logoBg: string;
  available: boolean;
  comingSoon?: boolean;
  popular?: boolean;
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "Alle integrasjoner" },
  { id: "accounting", label: "Regnskap" },
  { id: "erp", label: "ERP" },
  { id: "bank", label: "Bank" },
  { id: "transfer", label: "Filoverføring" },
  { id: "other", label: "Annet" },
];

const INTEGRATIONS: Integration[] = [
  {
    id: "tripletex",
    name: "Tripletex",
    description: "Norges mest brukte regnskapssystem. Toveis synkronisering av hovedbok, kunder og leverandører.",
    category: "accounting",
    logoElement: <span className="text-lg font-bold text-emerald-600">Tx</span>,
    logoBg: "bg-emerald-50 dark:bg-emerald-950/40",
    available: true,
    popular: true,
  },
  {
    id: "visma-nxt",
    name: "Visma Business NXT",
    description: "Skybasert ERP fra Visma. Import av hovedbok, reskontro og banktransaksjoner via GraphQL.",
    category: "erp",
    logoElement: <span className="text-lg font-bold text-orange-600">V</span>,
    logoBg: "bg-orange-50 dark:bg-orange-950/40",
    available: true,
    popular: true,
  },
  {
    id: "xledger",
    name: "Xledger",
    description: "Skybasert ERP for mellomstore og store virksomheter. Full hovedbok-integrasjon.",
    category: "erp",
    logoElement: <span className="text-lg font-bold text-sky-600">Xl</span>,
    logoBg: "bg-sky-50 dark:bg-sky-950/40",
    available: true,
  },
  {
    id: "business-central",
    name: "Business Central",
    description: "Microsoft Dynamics 365 Business Central. ERP-integrasjon via API med hovedbok og reskontro.",
    category: "erp",
    logoElement: <span className="text-lg font-bold text-blue-600">BC</span>,
    logoBg: "bg-blue-50 dark:bg-blue-950/40",
    available: true,
    popular: true,
  },
  {
    id: "fiken",
    name: "Fiken",
    description: "Enkelt regnskapssystem for små bedrifter. Import av bilag og transaksjoner.",
    category: "accounting",
    logoElement: <span className="text-lg font-bold text-violet-600">Fi</span>,
    logoBg: "bg-violet-50 dark:bg-violet-950/40",
    available: true,
  },
  {
    id: "poweroffice",
    name: "PowerOffice Go",
    description: "Skybasert regnskap med åpent API. Synkronisering av hovedbok og banktransaksjoner.",
    category: "accounting",
    logoElement: <span className="text-lg font-bold text-rose-600">Po</span>,
    logoBg: "bg-rose-50 dark:bg-rose-950/40",
    available: true,
  },
  {
    id: "finago",
    name: "Finago",
    description: "Nordisk regnskapsplattform med lønn, regnskap og rapportering i ett.",
    category: "accounting",
    logoElement: <span className="text-lg font-bold text-teal-600">Fg</span>,
    logoBg: "bg-teal-50 dark:bg-teal-950/40",
    available: true,
  },
  {
    id: "unimicro",
    name: "Uni Micro",
    description: "Norsk regnskaps- og ERP-system. Integrasjon via API for hovedbok og bilag.",
    category: "erp",
    logoElement: <span className="text-lg font-bold text-indigo-600">Um</span>,
    logoBg: "bg-indigo-50 dark:bg-indigo-950/40",
    available: true,
  },
  {
    id: "sftp",
    name: "SFTP",
    description: "Automatisk filhenting fra bank og regnskapssystem via sikker SFTP-tilkobling.",
    category: "transfer",
    logoElement: <Server className="size-5 text-zinc-600" />,
    logoBg: "bg-zinc-100 dark:bg-zinc-800/60",
    available: true,
    popular: true,
  },
  {
    id: "aiia-openbanking",
    name: "Aiia Open Banking",
    description: "PSD2-basert banktilkobling. Automatisk henting av kontoutskrifter fra alle norske banker.",
    category: "bank",
    logoElement: <Landmark className="size-5 text-cyan-600" />,
    logoBg: "bg-cyan-50 dark:bg-cyan-950/40",
    available: true,
    popular: true,
  },
  {
    id: "neonomics",
    name: "Neonomics",
    description: "Open Banking-plattform med tilgang til norske og nordiske banker for automatisk kontoutskrift.",
    category: "bank",
    logoElement: <Globe className="size-5 text-purple-600" />,
    logoBg: "bg-purple-50 dark:bg-purple-950/40",
    available: true,
  },
  {
    id: "dnb",
    name: "DNB",
    description: "Direkte bankintegrasjon med DNB for automatisk innhenting av kontoutskrifter.",
    category: "bank",
    logoElement: <span className="text-lg font-bold text-green-700">DNB</span>,
    logoBg: "bg-green-50 dark:bg-green-950/40",
    available: false,
    comingSoon: true,
  },
  {
    id: "nordea",
    name: "Nordea",
    description: "Klink/Telepay-integrasjon og direkte banktilkobling for filimport.",
    category: "bank",
    logoElement: <span className="text-lg font-bold text-blue-800">N</span>,
    logoBg: "bg-blue-50 dark:bg-blue-950/40",
    available: false,
    comingSoon: true,
  },
  {
    id: "altinn",
    name: "Altinn",
    description: "Maskinporten-integrasjon for innhenting av A-melding, MVA og skattemelding fra Altinn.",
    category: "other",
    logoElement: <span className="text-lg font-bold text-red-700">A</span>,
    logoBg: "bg-red-50 dark:bg-red-950/40",
    available: false,
    comingSoon: true,
  },
  {
    id: "csv-excel",
    name: "CSV / Excel",
    description: "Manuell filimport av CSV- og Excel-filer. Støtter egendefinerte kolonnemappinger.",
    category: "transfer",
    logoElement: <FileSpreadsheet className="size-5 text-green-600" />,
    logoBg: "bg-green-50 dark:bg-green-950/40",
    available: true,
  },
  {
    id: "camt053",
    name: "CAMT.053 / ISO 20022",
    description: "Standardformat for bankfiler. Automatisk parsing av kontoutskrifter i XML-format.",
    category: "transfer",
    logoElement: <CreditCard className="size-5 text-amber-600" />,
    logoBg: "bg-amber-50 dark:bg-amber-950/40",
    available: true,
  },
];

export default function IntegrasjonsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [enabledIds, setEnabledIds] = useState<Set<string>>(
    new Set(["csv-excel", "camt053"])
  );
  const [tripletexOpen, setTripletexOpen] = useState(false);
  const [vismaNxtOpen, setVismaNxtOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = INTEGRATIONS;
    if (activeCategory !== "all") {
      list = list.filter((i) => i.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const toggleIntegration = (id: string) => {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Plug className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Integrasjoner</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Koble til regnskapssystem, bank og filoverføring for automatisk dataflyt.
        </p>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Søk integrasjoner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((integration) => {
          const enabled = enabledIds.has(integration.id);
          return (
            <div
              key={integration.id}
              className={cn(
                "rounded-lg border bg-card p-5 flex flex-col justify-between transition-colors",
                enabled && "border-primary/20",
                integration.comingSoon && "opacity-70"
              )}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("size-11 rounded-lg flex items-center justify-center", integration.logoBg)}>
                    {integration.logoElement}
                  </div>
                  {integration.popular && (
                    <Badge variant="outline" className="text-[10px] font-medium">Populær</Badge>
                  )}
                  {integration.comingSoon && (
                    <Badge variant="outline" className="text-[10px] font-medium text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">Kommer</Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold mb-1">{integration.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{integration.description}</p>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={integration.comingSoon}
                  onClick={() => {
                    if (integration.id === "tripletex") setTripletexOpen(true);
                    if (integration.id === "visma-nxt") setVismaNxtOpen(true);
                  }}
                >
                  <Settings2 className="size-3" />
                  Konfigurer
                </Button>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleIntegration(integration.id)}
                  disabled={integration.comingSoon}
                />
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Plug className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Ingen integrasjoner funnet.</p>
        </div>
      )}

      <TripletexConfigDialog
        open={tripletexOpen}
        onOpenChange={setTripletexOpen}
      />

      <VismaNxtConfigDialog
        open={vismaNxtOpen}
        onOpenChange={setVismaNxtOpen}
      />
    </div>
  );
}
