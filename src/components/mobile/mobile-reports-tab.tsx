"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useFormatting } from "@/contexts/ui-preferences-context";
import {
  FileText,
  GitMerge,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportLog {
  id: string;
  jobType: "smart_match" | "report" | "both";
  status: "success" | "failed" | "partial";
  matchCount: number | null;
  transactionCount: number | null;
  reportSent: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string | null;
  clientName: string;
}

const JOB_TYPE_LABEL: Record<string, string> = {
  smart_match: "Smart Match",
  report: "Rapport",
  both: "Match + Rapport",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  success: { icon: CheckCircle2, className: "text-emerald-500", label: "Fullfort" },
  failed: { icon: XCircle, className: "text-red-500", label: "Feilet" },
  partial: { icon: AlertTriangle, className: "text-amber-500", label: "Delvis" },
};

export function MobileReportsTab() {
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { fmtDate: fmtD } = useFormatting();
  const fetchedRef = useRef(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent-reports/history?limit=50");
      if (!res.ok) return;
      const data: ReportLog[] = await res.json();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchLogs();
    }
  }, [fetchLogs]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "nå";
    if (diffMins < 60) return `${diffMins}m siden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}t siden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d siden`;
    return fmtD(d);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
        <h2 className="text-base font-semibold">Rapporter</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {logs.length} {logs.length === 1 ? "rapport" : "rapporter"}
        </span>
      </div>

      {/* Reports list */}
      <div className="flex-1 overflow-y-auto">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
              <FileText className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Ingen rapporter enda</p>
            <p className="text-xs text-muted-foreground/60 mt-1 text-center">
              Aktiver Revizo Agent i innstillinger for automatiske rapporter.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const statusCfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.success;
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                  {log.jobType === "smart_match" ? (
                    <GitMerge className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">
                      {log.clientName}
                    </p>
                    <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusCfg.className)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {JOB_TYPE_LABEL[log.jobType] ?? log.jobType}
                    {log.matchCount != null && ` \u00b7 ${log.matchCount} treff`}
                    {log.reportSent && " \u00b7 Sendt p\u00e5 e-post"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                      {formatTime(log.createdAt)}
                    </span>
                    {log.durationMs != null && (
                      <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                        {formatDuration(log.durationMs)}
                      </span>
                    )}
                  </div>
                  {log.errorMessage && (
                    <p className="text-xs text-destructive mt-1 line-clamp-2">
                      {log.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
