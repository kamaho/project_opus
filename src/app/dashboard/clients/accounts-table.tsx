"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  BarChart3,
  ChevronLeft,
  FolderOpen,
  Zap,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormatting } from "@/contexts/ui-preferences-context";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { NavArrowButton } from "@/components/ui/nav-arrow-button";
import { SelectionActionBar } from "@/components/clients/selection-action-bar";
const AssignUserCell = dynamic(
  () => import("@/components/clients/assign-user-cell").then((m) => m.AssignUserCell),
  { ssr: false }
);
import { AssignGroupCell } from "@/components/clients/assign-group-cell";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface AccountRow {
  id: string;
  matchGroup: string;
  company: string;
  ledgerAccountGroup: string;
  openItems: number;
  leftBalance: number;
  rightBalance: number;
  hasDoc: boolean;
  lastRecon: string | null;
  assignedUserId: string | null;
  integrationSource: string | null;
}

export interface ClientGroup {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  assignedUserId?: string | null;
  members: { clientId: string; clientName: string; companyName: string }[];
}

interface AccountsTableProps {
  rows: AccountRow[];
  groups?: ClientGroup[];
  initialActiveGroupId?: string | null;
  onInitialGroupConsumed?: () => void;
  onCompare?: (ids: string[]) => void;
  onCreateGroup?: (preselectedIds: string[]) => void;
  onSmartMatchGroup?: (group: ClientGroup) => void;
  onExportGroup?: (group: ClientGroup) => void;
  onActiveGroupChange?: (group: ClientGroup | null) => void;
  /** When set, show "Tilbake til grupper" instead of "Vis alle" and call this on click (e.g. group detail on Grupper tab) */
  onBack?: () => void;
  /** Rendered in the toolbar next to Sammenlign / søk (e.g. "+ Ny klient" button) */
  toolbarAppend?: ReactNode;
}

export function AccountsTable({
  rows,
  groups = [],
  initialActiveGroupId = null,
  onInitialGroupConsumed,
  onCompare,
  onCreateGroup,
  onSmartMatchGroup,
  onExportGroup,
  onActiveGroupChange,
  onBack,
  toolbarAppend,
}: AccountsTableProps) {
  const { fmtNum, fmtDate: fmtD } = useFormatting();
  const router = useRouter();
  const formatBalance = fmtNum;

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState<ClientGroup | null>(() =>
    initialActiveGroupId ? (groups.find((g) => g.id === initialActiveGroupId) ?? null) : null
  );

  const onInitialGroupConsumedRef = useRef(onInitialGroupConsumed);
  useEffect(() => { onInitialGroupConsumedRef.current = onInitialGroupConsumed; });
  useEffect(() => {
    if (!initialActiveGroupId) return;
    const g = groups.find((x) => x.id === initialActiveGroupId) ?? null;
    setActiveGroup(g);
    onInitialGroupConsumedRef.current?.();
  }, [initialActiveGroupId, groups]);

  const onActiveGroupChangeRef = useRef(onActiveGroupChange);
  useEffect(() => { onActiveGroupChangeRef.current = onActiveGroupChange; });
  useEffect(() => {
    onActiveGroupChangeRef.current?.(activeGroup);
  }, [activeGroup]);

  const [assignMap, setAssignMap] = useState<Map<string, string | null>>(() => {
    const m = new Map<string, string | null>();
    for (const r of rows) m.set(r.id, r.assignedUserId);
    return m;
  });

  const filteredRows = useMemo(() => {
    if (!activeGroup) return rows;
    const memberIds = new Set(activeGroup.members.map((m) => m.clientId));
    return rows.filter((r) => memberIds.has(r.id));
  }, [rows, activeGroup]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleCompare = useCallback(() => {
    onCompare?.(Array.from(selectedIds));
  }, [onCompare, selectedIds]);

  const handleCreateGroup = useCallback(() => {
    onCreateGroup?.(Array.from(selectedIds));
  }, [onCreateGroup, selectedIds]);

  const handleAssign = useCallback(
    async (clientId: string, userId: string | null) => {
      setAssignMap((prev) => new Map(prev).set(clientId, userId));
      await fetch(`/api/clients/${clientId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    },
    []
  );

  const handleGroupAssign = useCallback(
    async (userId: string | null) => {
      if (!activeGroup) return;
      await fetch(`/api/client-groups/${activeGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedUserId: userId }),
      });
      setActiveGroup((prev) =>
        prev ? { ...prev, assignedUserId: userId } : null
      );
      router.refresh();
    },
    [activeGroup, router]
  );

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------

  const columns: ColumnDef<AccountRow>[] = useMemo(
    () => [
      {
        id: "nav",
        header: "",
        accessorFn: () => "",
        sortable: false,
        filterable: false,
        hideable: false,
        width: "38px",
        cell: (row) => (
          <Link href={`/dashboard/clients/${row.id}/matching`}>
            <NavArrowButton />
          </Link>
        ),
      },
      {
        id: "name",
        header: "Klient",
        accessorFn: (row) => row.matchGroup,
        cell: (row) => (
          <Link
            href={`/dashboard/clients/${row.id}/matching`}
            className="font-medium hover:underline"
          >
            {row.matchGroup}
          </Link>
        ),
      },
      {
        id: "company",
        header: "Selskap",
        accessorFn: (row) => row.company,
        cell: (row) => (
          <span className="text-muted-foreground">{row.company}</span>
        ),
      },
      {
        id: "source",
        header: "Kilde",
        accessorFn: (row) => row.integrationSource ?? "",
        align: "center",
        width: "64px",
        cell: (row) =>
          row.integrationSource === "tripletex" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 cursor-default">
                  Tx
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">Tripletex</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          ),
      },
      {
        id: "openItems",
        header: "Åpne poster",
        accessorFn: (row) => row.openItems,
        align: "right",
        cell: (row) => row.openItems,
      },
      {
        id: "m1Balance",
        header: "M1 saldo",
        accessorFn: (row) => row.leftBalance,
        align: "right",
        mono: true,
        cell: (row) => (
          <span className={row.leftBalance < 0 ? "text-destructive" : ""}>
            {formatBalance(row.leftBalance)}
          </span>
        ),
      },
      {
        id: "m2Balance",
        header: "M2 saldo",
        accessorFn: (row) => row.rightBalance,
        align: "right",
        mono: true,
        cell: (row) => (
          <span className={row.rightBalance < 0 ? "text-destructive" : ""}>
            {formatBalance(row.rightBalance)}
          </span>
        ),
      },
      {
        id: "diff",
        header: "Differanse",
        accessorFn: (row) => row.leftBalance - row.rightBalance,
        align: "right",
        mono: true,
        cell: (row) => {
          const diff = row.leftBalance - row.rightBalance;
          return (
            <span
              className={cn(
                "font-medium",
                diff !== 0
                  ? "text-destructive"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {formatBalance(diff)}
            </span>
          );
        },
      },
      {
        id: "lastRecon",
        header: "Siste avst.",
        accessorFn: (row) => row.lastRecon ?? "",
        cell: (row) => (
          <span className="text-muted-foreground">
            {row.lastRecon ? fmtD(row.lastRecon) : "—"}
          </span>
        ),
      },
      {
        id: "assigned",
        header: "Ansvarlig",
        accessorFn: (row) => row.assignedUserId ?? "",
        sortable: false,
        filterable: false,
        cell: (row) => (
          <AssignUserCell
            clientId={row.id}
            assignedUserId={assignMap.get(row.id) ?? null}
            onAssign={handleAssign}
          />
        ),
      },
    ],
    [formatBalance, fmtD, assignMap, handleAssign]
  );

  // ---------------------------------------------------------------------------
  // Toolbar content
  // ---------------------------------------------------------------------------

  const toolbarLeft = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={selectionMode ? "default" : "outline"}
        size="sm"
        onClick={() => {
          if (selectionMode) exitSelectionMode();
          else setSelectionMode(true);
        }}
        className="gap-1.5"
      >
        <BarChart3 className="h-3.5 w-3.5" />
        {selectionMode ? "Avbryt" : "Sammenlign"}
      </Button>
      {toolbarAppend}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {activeGroup && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 mb-3">
          {onBack ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground shrink-0"
              onClick={onBack}
            >
              <ChevronLeft className="h-3 w-3" />
              Tilbake til grupper
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground shrink-0"
              onClick={() => setActiveGroup(null)}
            >
              <X className="h-3 w-3" />
              Vis alle
            </Button>
          )}
          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-sm truncate">
              {activeGroup.name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "klient" : "klienter"}
            </span>
          </div>
          <AssignGroupCell
            groupId={activeGroup.id}
            assignedUserId={activeGroup.assignedUserId ?? null}
            onAssign={handleGroupAssign}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => onSmartMatchGroup?.(activeGroup)}
          >
            <Zap className="h-3 w-3" />
            Smart Match
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => onExportGroup?.(activeGroup)}
          >
            <FileText className="h-3 w-3" />
            Rapport
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredRows}
        getRowId={(row) => row.id}
        rowClassName={() => "data-table-row-with-nav-pill"}
        onRowClick={
          selectionMode
            ? undefined
            : (row) => router.push(`/dashboard/clients/${row.id}/matching`)
        }
        selectable={selectionMode}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        searchPlaceholder="Søk klienter, selskap…"
        toolbarLeft={toolbarLeft}
        emptyMessage="Ingen klienter"
      />

      {selectionMode && selectedIds.size > 0 && (
        <SelectionActionBar
          count={selectedIds.size}
          onCompare={handleCompare}
          onCreateGroup={handleCreateGroup}
          onCancel={exitSelectionMode}
        />
      )}
    </>
  );
}
