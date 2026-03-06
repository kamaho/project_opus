"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Building2, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { IntegrationBadge } from "@/components/ui/integration-badge";

type Company = { id: string; name: string; type?: string; integrationSources?: string[] };

const NONE_SENTINEL = "__none__";
const DEBOUNCE_MS = 250;

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
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const companyIdParam = searchParams.get("companyId");

  const urlSelectedIds = useMemo<Set<string>>(() => {
    if (!companyIdParam) return new Set<string>();
    return new Set(companyIdParam.split(",").filter(Boolean));
  }, [companyIdParam]);

  const [localIds, setLocalIds] = useState<Set<string>>(urlSelectedIds);

  useEffect(() => {
    setLocalIds(urlSelectedIds);
  }, [urlSelectedIds]);

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

  useEffect(() => {
    const handler = () => {
      fetchCompanies().then((fetched) => setCompanies(fetched));
    };
    window.addEventListener("revizo:companies-changed", handler);
    return () => window.removeEventListener("revizo:companies-changed", handler);
  }, [fetchCompanies]);

  const isNone = localIds.has(NONE_SENTINEL);
  const allSelected = !isNone && localIds.size === 0;
  const selectedCompanies = isNone
    ? []
    : allSelected
      ? companies
      : companies.filter((c) => localIds.has(c.id));

  const commitUrl = useCallback((ids: Set<string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (ids.has(NONE_SENTINEL)) {
        params.set("companyId", NONE_SENTINEL);
      } else if (ids.size === 0 || ids.size === companies.length) {
        params.delete("companyId");
      } else {
        params.set("companyId", Array.from(ids).join(","));
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, DEBOUNCE_MS);
  }, [searchParams, companies.length, pathname, router]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function toggleCompany(id: string) {
    setLocalIds((prev) => {
      let effective: Set<string>;
      if (prev.has(NONE_SENTINEL)) {
        effective = new Set([id]);
      } else if (prev.size === 0) {
        effective = new Set(companies.map((c) => c.id));
        effective.delete(id);
      } else {
        effective = new Set(prev);
        if (effective.has(id)) {
          effective.delete(id);
        } else {
          effective.add(id);
        }
      }
      if (effective.size === 0) {
        effective = new Set([NONE_SENTINEL]);
      } else if (effective.size === companies.length) {
        effective = new Set();
      }
      commitUrl(effective);
      return effective;
    });
  }

  function selectAll() {
    const next = new Set<string>();
    setLocalIds(next);
    commitUrl(next);
  }

  function selectNone() {
    const next = new Set([NONE_SENTINEL]);
    setLocalIds(next);
    commitUrl(next);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  let triggerLabel: string;
  if (isNone) {
    triggerLabel = "Ingen selskaper";
  } else if (allSelected) {
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

          <div className="flex items-center justify-between border-b px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              {isNone
                ? `0 av ${companies.length}`
                : allSelected
                  ? "Alle"
                  : `${selectedCompanies.length} av ${companies.length}`} valgt
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={selectAll}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded transition-colors",
                  allSelected
                    ? "text-foreground font-medium bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Alle
              </button>
              <button
                type="button"
                onClick={selectNone}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded transition-colors",
                  isNone
                    ? "text-foreground font-medium bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Ingen
              </button>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Ingen selskap funnet
              </div>
            )}
            {filtered.map((c) => {
              const checked = !isNone && (allSelected || localIds.has(c.id));
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
