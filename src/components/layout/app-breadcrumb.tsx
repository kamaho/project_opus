"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Building2, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { IntegrationBadge } from "@/components/ui/integration-badge";

type Company = { id: string; name: string; type?: string; integrationSources?: string[] };

const separator = (
  <span className="text-muted-foreground/50 px-1.5 select-none" aria-hidden>
    /
  </span>
);

export function AppBreadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const companyIdParam = searchParams.get("companyId");
  const selectedIds = useMemo<Set<string>>(() => {
    if (!companyIdParam) return new Set<string>();
    return new Set(companyIdParam.split(",").filter(Boolean));
  }, [companyIdParam]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data: Company[] = await res.json();
        return data.filter((c) => c.type !== "group");
      }
    } catch {}
    return [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fetched = await fetchCompanies();
      if (cancelled) return;
      setCompanies(fetched);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchCompanies]);

  const allSelected = selectedIds.size === 0 || selectedIds.size === companies.length;
  const selectedCompanies = allSelected ? companies : companies.filter((c) => selectedIds.has(c.id));

  function updateUrl(ids: Set<string>) {
    const params = new URLSearchParams(searchParams.toString());
    if (ids.size === 0 || ids.size === companies.length) {
      params.delete("companyId");
    } else {
      params.set("companyId", Array.from(ids).join(","));
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function toggleCompany(id: string) {
    const effectiveSelected = allSelected
      ? new Set(companies.map((c) => c.id))
      : new Set(selectedIds);
    if (effectiveSelected.has(id)) {
      effectiveSelected.delete(id);
    } else {
      effectiveSelected.add(id);
    }
    updateUrl(effectiveSelected);
  }

  function selectAll() {
    updateUrl(new Set(companies.map((c) => c.id)));
  }

  function selectNone() {
    updateUrl(new Set());
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  let triggerLabel: string;
  if (allSelected) {
    triggerLabel = "Alle selskaper";
  } else if (selectedCompanies.length === 1) {
    triggerLabel = selectedCompanies[0].name;
  } else {
    triggerLabel = `${selectedCompanies.length} selskaper`;
  }

  const segmentButtonClass =
    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <nav
      className="flex items-center gap-0 flex-1 min-w-0"
      aria-label="Brødsmule"
    >
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

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setTimeout(() => searchInputRef.current?.focus(), 0); else setSearch(""); }}>
        <PopoverTrigger
          className={cn(segmentButtonClass, "data-[state=open]:bg-muted/80")}
          disabled={loading}
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate max-w-[200px]">{triggerLabel}</span>
          {selectedCompanies.length === 1 && selectedCompanies[0].integrationSources && (
            <IntegrationBadge sources={selectedCompanies[0].integrationSources} />
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[280px] p-0">
          {/* Search */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk selskap..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Select all / none */}
          <div className="flex items-center justify-between border-b px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              {allSelected ? "Alle" : `${selectedCompanies.length} av ${companies.length}`} valgt
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
              >
                Alle
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
              >
                Ingen
              </button>
            </div>
          </div>

          {/* Company list */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Ingen selskap funnet
              </div>
            )}
            {filtered.map((c) => {
              const checked = allSelected || selectedIds.has(c.id);
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleCompany(c.id)}
                  />
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <IntegrationBadge sources={c.integrationSources ?? []} />
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </nav>
  );
}
