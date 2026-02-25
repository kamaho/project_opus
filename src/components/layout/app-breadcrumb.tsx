"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { ChevronDown, Building2, Wallet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string };
type Client = { id: string; name: string; companyId: string };

const separator = (
  <span className="text-muted-foreground/50 px-1.5 select-none" aria-hidden>
    /
  </span>
);

export function AppBreadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [currentClientFromApi, setCurrentClientFromApi] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const clientIdFromPath = pathname.match(/^\/dashboard\/clients\/([^/]+)/)?.[1] ?? null;
  const currentClient =
    currentClientFromApi ??
    (clientIdFromPath ? clients.find((c) => c.id === clientIdFromPath) ?? null : null);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch {
      setCompanies([]);
    }
  }, []);

  const fetchClients = useCallback(async (companyId: string | null) => {
    try {
      const url = companyId
        ? `/api/clients?companyId=${encodeURIComponent(companyId)}`
        : "/api/clients";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      } else {
        setClients([]);
      }
    } catch {
      setClients([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchCompanies();
      await fetchClients(null);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCompanies, fetchClients]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    fetchClients(selectedCompanyId);
  }, [selectedCompanyId, fetchClients]);

  useEffect(() => {
    if (currentClient && currentClient.companyId && !selectedCompanyId) {
      setSelectedCompanyId(currentClient.companyId);
    }
  }, [currentClient?.companyId, selectedCompanyId]);

  useEffect(() => {
    if (!clientIdFromPath) {
      setCurrentClientFromApi(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/clients/${clientIdFromPath}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCurrentClientFromApi(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientIdFromPath]);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const clientsForCompany = selectedCompanyId
    ? clients.filter((c) => c.companyId === selectedCompanyId)
    : clients;

  const segmentButtonClass =
    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <nav
      className="flex items-center gap-0 flex-1 min-w-0"
      aria-label="Brødsmule"
    >
      {/* Segment 1: Bruker miljø (organisasjon) */}
      <div className="flex items-center gap-0 shrink-0">
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "flex items-center",
              organizationSwitcherTrigger:
                "rounded-md px-2 py-1.5 h-auto text-sm font-medium data-[state=open]:bg-muted/80",
            },
          }}
        />
      </div>

      {separator}

      {/* Segment 2: Selskapsvelger */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(segmentButtonClass, "data-[state=open]:bg-muted/80")}
          disabled={loading}
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate max-w-[140px]">
            {selectedCompany?.name ?? "Velg selskap"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {companies.length === 0 && !loading && (
            <DropdownMenuItem disabled>Ingen selskap</DropdownMenuItem>
          )}
          {companies.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => setSelectedCompanyId(c.id)}
            >
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {separator}

      {/* Segment 3: Avstemming */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(segmentButtonClass, "data-[state=open]:bg-muted/80")}
          disabled={loading}
        >
          <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate max-w-[160px]">
            {currentClient?.name ?? (clientIdFromPath ? "…" : "Velg avstemming")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px] max-h-[280px] overflow-y-auto">
          {clientsForCompany.length === 0 && !loading && (
            <DropdownMenuItem disabled>Ingen avstemminger</DropdownMenuItem>
          )}
          {clientsForCompany.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => router.push(`/dashboard/clients/${c.id}/matching`)}
            >
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
