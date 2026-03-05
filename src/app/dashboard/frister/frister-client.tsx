"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, RefreshCw, AlertTriangle, Clock, TrendingUp, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/dashboard/frister/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMembersMap, initials } from "@/hooks/use-members-map";
import type { DeadlineListResponse, DeadlineWithSummary } from "@/lib/deadlines/types";

export default function FristerClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { membersMap } = useMembersMap();
  const initialFrom = searchParams.get("from") ?? getDefaultFrom();
  const initialTo = searchParams.get("to") ?? getDefaultTo();

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [statusFilter, setStatusFilter] = useState<string[]>(
    searchParams.get("status")?.split(",").filter(Boolean) ?? []
  );
  const [tab, setTab] = useState<"all" | "mine">(
    searchParams.get("tab") === "mine" ? "mine" : "all"
  );
  const [data, setData] = useState<DeadlineListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from !== getDefaultFrom()) params.set("from", from);
    if (to !== getDefaultTo()) params.set("to", to);
    if (statusFilter.length > 0) params.set("status", statusFilter.join(","));
    if (tab === "mine") params.set("tab", "mine");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [from, to, statusFilter, tab, pathname, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (statusFilter.length > 0) params.set("status", statusFilter.join(","));
      if (tab === "mine") params.set("assigned_to", "me");

      const res = await fetch(`/api/deadlines?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch deadlines:", err);
    } finally {
      setLoading(false);
    }
  }, [from, to, statusFilter, tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deadlines = data?.deadlines ?? [];
  const summary = data?.summary ?? { total: 0, done: 0, onTrack: 0, atRisk: 0, overdue: 0, notStarted: 0 };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Frister</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Tab bar */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "mine")}>
        <TabsList>
          <TabsTrigger value="all">Alle frister</TabsTrigger>
          <TabsTrigger value="mine">Mine oppgaver</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Fra</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Til</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
        <div className="flex gap-1 ml-2">
          {(["overdue", "at_risk", "on_track", "not_started", "done"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                );
              }}
              className={`transition-opacity ${statusFilter.includes(s) || statusFilter.length === 0 ? "opacity-100" : "opacity-40"}`}
            >
              <StatusBadge status={s} />
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Forfalt"
            value={summary.overdue}
            subtitle="krever handling"
            icon={<AlertTriangle className="size-4 text-red-500" />}
            highlight={summary.overdue > 0}
            highlightColor="red"
          />
          <SummaryCard
            label="Risiko"
            value={summary.atRisk}
            subtitle="frist innen 7 dager"
            icon={<Clock className="size-4 text-amber-500" />}
            highlight={summary.atRisk > 0}
            highlightColor="amber"
          />
          <SummaryCard
            label="På sporet"
            value={summary.onTrack}
            subtitle="arbeid pågår"
            icon={<TrendingUp className="size-4 text-blue-500" />}
          />
          <SummaryCard
            label="Ferdig"
            value={summary.done}
            subtitle="denne perioden"
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          />
        </div>
      )}

      {/* Matrix */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Ingen frister i denne perioden</p>
          <p className="text-xs text-muted-foreground mt-1">
            Juster datofilter eller generer frister for dine klienter
          </p>
        </div>
      ) : (
        <DeadlineMatrix deadlines={deadlines} statusFilter={statusFilter} membersMap={membersMap} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrix view — grouped by company, then deadline type, columns = months
// ---------------------------------------------------------------------------

const MONTH_LABELS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

function getMonthKey(dueDate: string): string {
  const d = new Date(dueDate + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`;
}

interface CompanyGroup {
  companyId: string;
  companyName: string;
  templates: {
    slug: string;
    name: string;
    cells: Map<string, DeadlineWithSummary>;
  }[];
  worstStatus: string;
}

function DeadlineMatrix({
  deadlines,
  statusFilter,
  membersMap,
}: {
  deadlines: DeadlineWithSummary[];
  statusFilter: string[];
  membersMap: Map<string, { id: string; name: string; imageUrl?: string }>;
}) {
  const { monthKeys, companyGroups } = useMemo(() => {
    const months = new Set<string>();
    const companyMap = new Map<string, Map<string, Map<string, DeadlineWithSummary>>>();

    for (const dl of deadlines) {
      const mk = getMonthKey(dl.dueDate);
      months.add(mk);

      if (!companyMap.has(dl.companyId)) companyMap.set(dl.companyId, new Map());
      const templateMap = companyMap.get(dl.companyId)!;
      if (!templateMap.has(dl.template.slug)) templateMap.set(dl.template.slug, new Map());
      templateMap.get(dl.template.slug)!.set(mk, dl);
    }

    const sortedMonths = Array.from(months).sort();

    const statusPriority: Record<string, number> = { overdue: 0, at_risk: 1, on_track: 2, not_started: 3, done: 4 };

    const groups: CompanyGroup[] = [];
    for (const [companyId, templateMap] of companyMap) {
      let worstPrio = 4;
      const templates: CompanyGroup["templates"] = [];
      for (const [slug, cellMap] of templateMap) {
        const firstCell = cellMap.values().next().value;
        templates.push({ slug, name: firstCell?.template.name ?? slug, cells: cellMap });
        for (const dl of cellMap.values()) {
          const p = statusPriority[dl.status] ?? 3;
          if (p < worstPrio) worstPrio = p;
        }
      }
      templates.sort((a, b) => a.name.localeCompare(b.name, "nb"));

      const companyName = deadlines.find((d) => d.companyId === companyId)?.company.name ?? companyId;
      const worstStatus = Object.entries(statusPriority).find(([, v]) => v === worstPrio)?.[0] ?? "not_started";
      groups.push({ companyId, companyName, templates, worstStatus });
    }

    groups.sort((a, b) => {
      const pa = statusPriority[a.worstStatus] ?? 3;
      const pb = statusPriority[b.worstStatus] ?? 3;
      if (pa !== pb) return pa - pb;
      return a.companyName.localeCompare(b.companyName, "nb");
    });

    return { monthKeys: sortedMonths, companyGroups: groups };
  }, [deadlines]);

  const hasFilter = statusFilter.length > 0;

  return (
    <div className="space-y-4">
      {companyGroups.map((group) => (
        <div key={group.companyId} className="rounded-lg border bg-card overflow-hidden">
          {/* Company header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
            <StatusBadge status={group.worstStatus as DeadlineWithSummary["status"]} />
            <span className="text-sm font-semibold">{group.companyName}</span>
            <span className="text-xs text-muted-foreground tabular-nums ml-auto">
              {group.templates.reduce((sum, t) => sum + t.cells.size, 0)} frister
            </span>
          </div>

          {/* Grid: template rows x month columns */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground sticky left-0 bg-card z-10 w-40 min-w-[160px]">
                    Fristtype
                  </th>
                  {monthKeys.map((mk) => (
                    <th key={mk} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground min-w-[100px]">
                      {getMonthLabel(mk)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {group.templates.map((tmpl) => (
                  <tr key={tmpl.slug} className="group/row">
                    <td className="px-4 py-2.5 text-sm font-medium sticky left-0 bg-card z-10">
                      {tmpl.name}
                    </td>
                    {monthKeys.map((mk) => {
                      const dl = tmpl.cells.get(mk);
                      if (!dl) {
                        return (
                          <td key={mk} className="px-2 py-2.5 text-center">
                            <span className="text-muted-foreground/30">—</span>
                          </td>
                        );
                      }
                      const dimmed = hasFilter && !statusFilter.includes(dl.status);
                      const { total, completed } = dl.taskSummary;
                      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                      return (
                        <td key={mk} className="px-2 py-2.5">
                          <Link
                            href={`/dashboard/frister/${dl.id}`}
                            prefetch={false}
                            className={cn(
                              "group/cell flex flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-all hover:bg-muted/50",
                              dimmed && "opacity-20"
                            )}
                          >
                            <StatusBadge status={dl.status} />
                            {total > 0 ? (
                              <div className="flex items-center gap-1 w-full">
                                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      dl.status === "done" ? "bg-emerald-500" :
                                      dl.status === "overdue" ? "bg-red-500" :
                                      dl.status === "at_risk" ? "bg-amber-500" : "bg-blue-500"
                                    )}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {completed}/{total}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Ingen oppgaver</span>
                            )}
                            {dl.assigneeId && (() => {
                              const member = membersMap.get(dl.assigneeId);
                              if (!member) return null;
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Avatar className="size-4">
                                      <AvatarImage src={member.imageUrl} alt={member.name} />
                                      <AvatarFallback className="text-[8px]">{initials(member.name)}</AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">
                                    Ansvarlig: {member.name}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  highlight = false,
  highlightColor,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  highlight?: boolean;
  highlightColor?: "red" | "amber";
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card px-4 py-3",
      highlight && highlightColor === "red" && "border-red-500/30 bg-red-500/5",
      highlight && highlightColor === "amber" && "border-amber-500/30 bg-amber-500/5",
    )}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className={cn(
        "text-2xl font-semibold tabular-nums",
        highlight && highlightColor === "red" && "text-red-500",
        highlight && highlightColor === "amber" && "text-amber-500",
      )}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function getDefaultFrom(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function getDefaultTo(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().slice(0, 10);
}
