"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { scheduleLabel } from "@/lib/agent-scheduler";

interface AgentConfig {
  enabled: boolean;
  reportTypes: string[];
  smartMatchEnabled: boolean;
  smartMatchSchedule: string | null;
  reportSchedule: string | null;
  specificDates: string[];
  preferredTime: string;
  nextMatchRun: string | null;
  nextReportRun: string | null;
  lastMatchRun: string | null;
  lastReportRun: string | null;
  lastMatchCount: number | null;
}

interface JobLog {
  id: string;
  jobType: string;
  status: string;
  matchCount: number | null;
  transactionCount: number | null;
  reportSent: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

const SCHEDULE_OPTIONS = [
  { value: "daily", label: "Daglig" },
  { value: "weekly_mon", label: "Ukentlig (mandag)" },
  { value: "weekly_tue", label: "Ukentlig (tirsdag)" },
  { value: "weekly_wed", label: "Ukentlig (onsdag)" },
  { value: "weekly_thu", label: "Ukentlig (torsdag)" },
  { value: "weekly_fri", label: "Ukentlig (fredag)" },
  { value: "monthly_1", label: "Månedlig (1.)" },
  { value: "monthly_15", label: "Månedlig (15.)" },
  { value: "biweekly", label: "Annenhver uke" },
];

const DEFAULT_CONFIG: AgentConfig = {
  enabled: false,
  reportTypes: ["open_items"],
  smartMatchEnabled: true,
  smartMatchSchedule: null,
  reportSchedule: null,
  specificDates: [],
  preferredTime: "03:00",
  nextMatchRun: null,
  nextReportRun: null,
  lastMatchRun: null,
  lastReportRun: null,
  lastMatchCount: null,
};

export function AgentReportSettings({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newDate, setNewDate] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, logsRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/agent-config`),
        fetch(`/api/clients/${clientId}/agent-logs`),
      ]);
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open) {
      fetchConfig();
      setDirty(false);
    }
  }, [open, fetchConfig]);

  const update = (patch: Partial<AgentConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/agent-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          reportTypes: config.reportTypes,
          smartMatchEnabled: config.smartMatchEnabled,
          smartMatchSchedule: config.smartMatchSchedule,
          reportSchedule: config.reportSchedule,
          specificDates: config.specificDates,
          preferredTime: config.preferredTime,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setConfig(saved);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const addSpecificDate = () => {
    if (!newDate) return;
    if (config.specificDates.includes(newDate)) return;
    update({
      specificDates: [...config.specificDates, newDate].sort(),
    });
    setNewDate("");
  };

  const removeSpecificDate = (d: string) => {
    update({
      specificDates: config.specificDates.filter((x) => x !== d),
    });
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Reviz
          </SheetTitle>
          <SheetDescription>
            Konfigurer automatisk Smart Match og rapportering for denne klienten.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Main toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Aktiver Reviz</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatisk Smart Match og rapportering
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
              />
            </div>

            <hr className="border-border" />

            {/* Report types */}
            <div className={cn(!config.enabled && "opacity-50 pointer-events-none")}>
              <Label className="text-sm font-medium">Rapporttyper</Label>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.reportTypes.includes("open_items")}
                    onChange={(e) => {
                      const types = e.target.checked
                        ? [...config.reportTypes, "open_items"]
                        : config.reportTypes.filter((t) => t !== "open_items");
                      update({ reportTypes: types });
                    }}
                    className="rounded"
                  />
                  Åpne poster
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" disabled className="rounded opacity-50" />
                  Lukkede poster
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Kommer snart</span>
                </label>
              </div>
            </div>

            <hr className="border-border" />

            {/* Smart Match schedule */}
            <div className={cn(!config.enabled && "opacity-50 pointer-events-none")}>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Smart Match</Label>
                <Switch
                  checked={config.smartMatchEnabled}
                  onCheckedChange={(v) => update({ smartMatchEnabled: v })}
                />
              </div>
              {config.smartMatchEnabled && (
                <Select
                  value={config.smartMatchSchedule ?? ""}
                  onValueChange={(v) => update({ smartMatchSchedule: v || null })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Velg frekvens" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {config.nextMatchRun && (
                <p className="text-xs text-muted-foreground mt-1">
                  Neste kjøring: {fmtDate(config.nextMatchRun)}
                </p>
              )}
            </div>

            <hr className="border-border" />

            {/* Report schedule */}
            <div className={cn(!config.enabled && "opacity-50 pointer-events-none")}>
              <Label className="text-sm font-medium mb-2 block">Rapportfrekvens</Label>
              <Select
                value={config.reportSchedule ?? ""}
                onValueChange={(v) => update({ reportSchedule: v || null })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Velg frekvens" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config.nextReportRun && (
                <p className="text-xs text-muted-foreground mt-1">
                  Neste rapport: {fmtDate(config.nextReportRun)}
                </p>
              )}
            </div>

            <hr className="border-border" />

            {/* Preferred time */}
            <div className={cn(!config.enabled && "opacity-50 pointer-events-none")}>
              <Label className="text-sm font-medium mb-2 block">Tidspunkt (UTC)</Label>
              <input
                type="time"
                value={config.preferredTime}
                onChange={(e) => update({ preferredTime: e.target.value })}
                className="h-8 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>

            <hr className="border-border" />

            {/* Specific dates */}
            <div className={cn(!config.enabled && "opacity-50 pointer-events-none")}>
              <Label className="text-sm font-medium mb-2 block">Spesifikke datoer</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Legg til enkeltdatoer for ekstra kjøringer (f.eks. årsavslutning, MVA-frist).
              </p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-8 rounded-md border bg-transparent px-2 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={addSpecificDate}
                  disabled={!newDate}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Legg til
                </Button>
              </div>
              {config.specificDates.length > 0 && (
                <div className="space-y-1">
                  {config.specificDates.map((d) => (
                    <div
                      key={d}
                      className="flex items-center justify-between rounded-md border px-2 py-1 text-sm"
                    >
                      <span className="tabular-nums">{d}</span>
                      <button
                        type="button"
                        onClick={() => removeSpecificDate(d)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Status */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Siste kjøringer</Label>
              {config.lastMatchRun && (
                <p className="text-xs text-muted-foreground">
                  Siste Smart Match: {fmtDate(config.lastMatchRun)}
                  {config.lastMatchCount != null && ` — ${config.lastMatchCount} matcher`}
                </p>
              )}
              {config.lastReportRun && (
                <p className="text-xs text-muted-foreground">
                  Siste rapport: {fmtDate(config.lastReportRun)}
                </p>
              )}

              {logs.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {logs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                    >
                      {log.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : log.status === "partial" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="text-muted-foreground tabular-nums">
                        {fmtDate(log.createdAt)}
                      </span>
                      <span className="font-medium">
                        {log.jobType === "both"
                          ? "Match + Rapport"
                          : log.jobType === "smart_match"
                            ? "Smart Match"
                            : "Rapport"}
                      </span>
                      {log.matchCount != null && log.matchCount > 0 && (
                        <span className="text-muted-foreground">
                          {log.matchCount} matcher
                        </span>
                      )}
                      {log.durationMs != null && (
                        <span className="text-muted-foreground ml-auto">
                          {(log.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Ingen kjøringer ennå.</p>
              )}
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="border-t pt-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Lagrer...
              </>
            ) : (
              "Lagre"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
