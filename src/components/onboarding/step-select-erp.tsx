"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface ERPSystem {
  id: string;
  name: string;
  description: string;
  logoElement: React.ReactNode;
  logoBg: string;
  available: boolean;
  popular?: boolean;
}

const ERP_SYSTEMS: ERPSystem[] = [
  {
    id: "tripletex",
    name: "Tripletex",
    description: "Norges mest brukte regnskapssystem. Toveis synkronisering av hovedbok og banktransaksjoner.",
    logoElement: <span className="text-lg font-bold text-emerald-600">Tx</span>,
    logoBg: "bg-emerald-50 dark:bg-emerald-950/40",
    available: true,
    popular: true,
  },
  {
    id: "visma-nxt",
    name: "Visma.net ERP",
    description: "Skybasert ERP fra Visma. Import av hovedbok, reskontro og banktransaksjoner.",
    logoElement: <span className="text-lg font-bold text-orange-600">V</span>,
    logoBg: "bg-orange-50 dark:bg-orange-950/40",
    available: false,
  },
  {
    id: "business-central",
    name: "Business Central",
    description: "Microsoft Dynamics 365 Business Central. ERP-integrasjon via API.",
    logoElement: <span className="text-lg font-bold text-blue-600">BC</span>,
    logoBg: "bg-blue-50 dark:bg-blue-950/40",
    available: false,
  },
  {
    id: "poweroffice",
    name: "PowerOffice Go",
    description: "Skybasert regnskap med åpent API. Synkronisering av hovedbok og bank.",
    logoElement: <span className="text-lg font-bold text-rose-600">Po</span>,
    logoBg: "bg-rose-50 dark:bg-rose-950/40",
    available: false,
  },
  {
    id: "fiken",
    name: "Fiken",
    description: "Enkelt regnskapssystem for små bedrifter. Import av bilag og transaksjoner.",
    logoElement: <span className="text-lg font-bold text-violet-600">Fi</span>,
    logoBg: "bg-violet-50 dark:bg-violet-950/40",
    available: false,
  },
  {
    id: "xledger",
    name: "Xledger",
    description: "Skybasert ERP for mellomstore og store virksomheter.",
    logoElement: <span className="text-lg font-bold text-sky-600">Xl</span>,
    logoBg: "bg-sky-50 dark:bg-sky-950/40",
    available: false,
  },
];

interface StepSelectERPProps {
  onSelect: (erpId: string) => void;
}

export function StepSelectERP({ onSelect }: StepSelectERPProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Velg regnskapssystem
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Velg systemet du bruker for automatisk synkronisering. Flere
          integrasjoner lanseres fortløpende.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ERP_SYSTEMS.map((erp) => (
          <button
            key={erp.id}
            type="button"
            onClick={() => erp.available && onSelect(erp.id)}
            disabled={!erp.available}
            className={cn(
              "group flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
              erp.available
                ? "hover:border-foreground/30 hover:bg-foreground/[0.02] cursor-pointer"
                : "opacity-60 cursor-not-allowed"
            )}
          >
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", erp.logoBg)}>
              {erp.logoElement}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{erp.name}</span>
                {erp.popular && (
                  <Badge variant="outline" className="text-[10px] font-medium">
                    Populær
                  </Badge>
                )}
                {!erp.available && (
                  <Badge variant="outline" className="text-[10px] font-medium text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                    Kommer
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {erp.description}
              </p>
            </div>
            {erp.available && (
              <ChevronRight className="h-4 w-4 shrink-0 mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
