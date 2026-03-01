"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRight, Landmark, Globe, Server } from "lucide-react";

interface BankOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  popular?: boolean;
}

const BANK_OPTIONS: BankOption[] = [
  {
    id: "aiia-openbanking",
    name: "Aiia Open Banking",
    description: "PSD2-basert banktilkobling. Automatisk henting av kontoutskrifter fra alle norske banker.",
    icon: <Landmark className="h-5 w-5 text-cyan-600" />,
    iconBg: "bg-cyan-50 dark:bg-cyan-950/40",
    popular: true,
  },
  {
    id: "neonomics",
    name: "Neonomics",
    description: "Open Banking-plattform med tilgang til norske og nordiske banker.",
    icon: <Globe className="h-5 w-5 text-purple-600" />,
    iconBg: "bg-purple-50 dark:bg-purple-950/40",
  },
  {
    id: "sftp",
    name: "SFTP",
    description: "Automatisk filhenting fra bank via sikker SFTP-tilkobling.",
    icon: <Server className="h-5 w-5 text-zinc-600" />,
    iconBg: "bg-zinc-100 dark:bg-zinc-800/60",
  },
  {
    id: "dnb",
    name: "DNB",
    description: "Direkte bankintegrasjon med DNB for automatisk kontoutskrifter.",
    icon: <span className="text-sm font-bold text-green-700">DNB</span>,
    iconBg: "bg-green-50 dark:bg-green-950/40",
  },
  {
    id: "nordea",
    name: "Nordea",
    description: "Direktekobling for automatisk innhenting av kontoutskrifter.",
    icon: <span className="text-sm font-bold text-blue-800">N</span>,
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
  },
];

interface StepConnectBankProps {
  onContinue: () => void;
}

export function StepConnectBank({ onContinue }: StepConnectBankProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Koble til bank
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Automatisk bankimport er under utvikling. Du kan importere bankfiler
          manuelt i mellomtiden.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Vi jobber med bankintegrasjoner og varsler deg når de er klare. I mellomtiden kan du importere bankfiler (CSV, Excel, CAMT.053) direkte i avstemmingsvisningen.
        </p>
      </div>

      <div className="space-y-2">
        {BANK_OPTIONS.map((bank) => (
          <div
            key={bank.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 opacity-60"
            )}
          >
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", bank.iconBg)}>
              {bank.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{bank.name}</span>
                {bank.popular && (
                  <Badge variant="outline" className="text-[10px] font-medium">
                    Populær
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] font-medium text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                  Kommer snart
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bank.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-2">
        <Button size="lg" onClick={onContinue} className="gap-2">
          Fortsett uten bank-tilkobling
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
