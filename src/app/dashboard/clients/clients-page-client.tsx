"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountsTable, type AccountRow, type ClientGroup } from "./accounts-table";
import { GroupCards } from "./group-cards";
import {
  CreateReconciliationDialog,
  type CreateReconciliationDialogRef,
} from "@/components/setup/create-reconciliation-dialog";
import { ComparisonOverlay } from "@/components/clients/comparison-overlay";
import { ClientGroupDialog, type ClientOption } from "@/components/clients/client-group-dialog";
import { GroupAutoMatchDialog } from "@/components/clients/group-auto-match-dialog";

interface ClientsPageClientProps {
  rows: AccountRow[];
  groups: ClientGroup[];
}

export function ClientsPageClient({ rows, groups }: ClientsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");

  const filteredRows = useMemo(() => {
    if (filterParam === "unmatched") return rows.filter((r) => r.openItems > 0);
    if (filterParam === "reconciled") return rows.filter((r) => r.openItems === 0);
    return rows;
  }, [rows, filterParam]);

  const [tab, setTab] = useState<"klienter" | "grupper">("klienter");
  const [initialActiveGroupId, setInitialActiveGroupId] = useState<string | null>(null);
  /** When set, Grupper tab shows this group's table instead of the card grid */
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const hasSyncing = rows.some(
    (r) => r.syncStatus === "pending" || r.syncStatus === "syncing"
  );

  useEffect(() => {
    if (!hasSyncing) return;
    const interval = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(interval);
  }, [hasSyncing, router]);

  // If selected group was deleted, return to card grid
  const groupStillExists = !selectedGroupId || groups.some((g) => g.id === selectedGroupId);
  if (!groupStillExists && selectedGroupId) {
    setSelectedGroupId(null);
  }

  // Dialog state -- all rendered outside Tabs
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupDialogPreselected, setGroupDialogPreselected] = useState<string[]>([]);
  const [editGroup, setEditGroup] = useState<ClientGroup | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<ClientGroup | null>(null);
  const [groupForMatchDialog, setGroupForMatchDialog] = useState<ClientGroup | null>(null);

  // Track which group is active inside the table (for group header actions)
  const [, setActiveGroupFromTable] = useState<ClientGroup | null>(null);

  const createDialogRef = useRef<CreateReconciliationDialogRef>(null);
  const newClientToolbarButton = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => createDialogRef.current?.open()}
      data-smart-info="Ny klient — opprett en ny klient (avstemmingsenhet)."
    >
      <Plus className="h-3.5 w-3.5" />
      Ny klient
    </Button>
  );

  // --- Callbacks from AccountsTable ---

  const handleCompare = useCallback((ids: string[]) => {
    setCompareIds(ids);
    setShowComparison(true);
  }, []);

  const handleCreateGroupFromSelection = useCallback((preselectedIds: string[]) => {
    setGroupDialogPreselected(preselectedIds);
    setShowGroupDialog(true);
  }, []);

  const handleSmartMatchGroup = useCallback((group: ClientGroup) => {
    setGroupForMatchDialog(group);
  }, []);

  const handleExportGroup = useCallback(async (group: ClientGroup) => {
    const clientIds = group.members.map((m) => m.clientId);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "group-matching",
          format: "pdf",
          groupMatchingData: {
            groupId: group.id,
            groupName: group.name,
            clientIds,
            reportType: "open",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Kunne ikke generere rapport");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gruppe-rapport-${group.name.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Rapport lastet ned");
    } catch {
      toast.error("Kunne ikke generere rapport");
    }
  }, []);

  // --- Callbacks from GroupCards ---

  const handleOpenGroupFromCard = useCallback((group: ClientGroup) => {
    setSelectedGroupId(group.id);
  }, []);

  // --- Save group (from dialog) ---

  const handleSaveGroup = useCallback(
    async (name: string, clientIds: string[]) => {
      if (editGroup) {
        const res = await fetch(`/api/client-groups/${editGroup.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, clientIds }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.error ?? "Kunne ikke oppdatere gruppen");
          return;
        }
      } else {
        const res = await fetch("/api/client-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, clientIds }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.error ?? "Kunne ikke opprette gruppen");
          return;
        }
      }
      setShowGroupDialog(false);
      setGroupDialogPreselected([]);
      setEditGroup(null);
      router.refresh();
    },
    [router, editGroup]
  );

  const handleEditGroup = useCallback((group: ClientGroup) => {
    setEditGroup(group);
    setGroupDialogPreselected([]);
    setShowGroupDialog(true);
  }, []);

  const handleDeleteGroup = useCallback((group: ClientGroup) => {
    setGroupToDelete(group);
  }, []);

  const handleConfirmDeleteGroup = useCallback(async () => {
    if (!groupToDelete) return;
    const id = groupToDelete.id;
    const res = await fetch(`/api/client-groups/${id}`, { method: "DELETE" });
    setGroupToDelete(null);
    if (!res.ok) {
      toast.error("Kunne ikke slette gruppen");
      return;
    }
    if (selectedGroupId === id) setSelectedGroupId(null);
    router.refresh();
  }, [groupToDelete, selectedGroupId, router]);

  const clientOptions: ClientOption[] = rows.map((r) => ({
    id: r.id,
    matchGroup: r.matchGroup,
    company: r.company,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Klient avstemming</h1>

      <CreateReconciliationDialog ref={createDialogRef} noTrigger />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "klienter" | "grupper");
          if (v === "klienter") setInitialActiveGroupId(null);
          if (v !== "grupper") setSelectedGroupId(null);
        }}
      >
        <TabsList className="w-fit">
          <TabsTrigger value="klienter">Klient avstemming</TabsTrigger>
          <TabsTrigger value="grupper">Grupper</TabsTrigger>
        </TabsList>

        <TabsContent value="klienter" className="mt-4">
          {filterParam && (
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className="text-muted-foreground">
                Filtrert:{" "}
                <span className="font-medium text-foreground">
                  {filterParam === "unmatched" ? "Klienter med åpne poster" : "Avstemte klienter"}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => router.push("/dashboard/clients")}
              >
                Vis alle
              </Button>
            </div>
          )}
          <AccountsTable
            rows={filteredRows}
            groups={groups}
            initialActiveGroupId={initialActiveGroupId}
            onInitialGroupConsumed={() => setInitialActiveGroupId(null)}
            onCompare={handleCompare}
            onCreateGroup={handleCreateGroupFromSelection}
            onSmartMatchGroup={handleSmartMatchGroup}
            onExportGroup={handleExportGroup}
            onActiveGroupChange={setActiveGroupFromTable}
            toolbarAppend={newClientToolbarButton}
          />
          <p className="text-muted-foreground text-sm mt-3">
            {filteredRows.length} {filteredRows.length === 1 ? "klient" : "klienter"}
            {filterParam ? ` (${rows.length} totalt)` : " totalt"}
          </p>
        </TabsContent>

        <TabsContent value="grupper" className="mt-4">
          {selectedGroupId && groups.find((g) => g.id === selectedGroupId) ? (() => {
            const selectedGroup = groups.find((g) => g.id === selectedGroupId)!;
            const memberIds = new Set(selectedGroup.members.map((m) => m.clientId));
            const groupRows = rows.filter((r) => memberIds.has(r.id));
            return (
              <AccountsTable
                rows={groupRows}
                groups={[selectedGroup]}
                initialActiveGroupId={selectedGroup.id}
                onBack={() => setSelectedGroupId(null)}
                onCompare={handleCompare}
                onCreateGroup={handleCreateGroupFromSelection}
                onSmartMatchGroup={handleSmartMatchGroup}
                onExportGroup={handleExportGroup}
                toolbarAppend={newClientToolbarButton}
              />
            );
          })() : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {groups.length} {groups.length === 1 ? "gruppe" : "grupper"}
              </p>
              <GroupCards
                groups={groups}
                onOpenGroup={handleOpenGroupFromCard}
                onReport={handleExportGroup}
                onSmartMatch={handleSmartMatchGroup}
                onCreateGroup={() => {
                  setEditGroup(null);
                  setGroupDialogPreselected([]);
                  setShowGroupDialog(true);
                }}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
                onGroupUpdated={() => router.refresh()}
              />
            </>
          )}
        </TabsContent>

      </Tabs>

      {/* All dialogs rendered outside Tabs to avoid removeChild crash */}
      <ComparisonOverlay
        open={showComparison}
        onOpenChange={setShowComparison}
        clientIds={compareIds}
      />

      <ClientGroupDialog
        open={showGroupDialog}
        onOpenChange={(open) => {
          setShowGroupDialog(open);
          if (!open) {
            setGroupDialogPreselected([]);
            setEditGroup(null);
          }
        }}
        clients={clientOptions}
        preselectedIds={groupDialogPreselected}
        editGroup={
          editGroup
            ? {
                id: editGroup.id,
                name: editGroup.name,
                members: editGroup.members.map((m) => ({ clientId: m.clientId })),
              }
            : null
        }
        onSave={handleSaveGroup}
      />

      {/* Slett gruppe – bekreftelsesdialog */}
      {groupToDelete && (
        <Dialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Slett gruppe</DialogTitle>
              <DialogDescription>
                Er du sikker på at du vil slette gruppen «{groupToDelete.name}»? Dette kan ikke angres.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setGroupToDelete(null)}>
                Avbryt
              </Button>
              <Button variant="destructive" onClick={handleConfirmDeleteGroup}>
                Slett
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {groupForMatchDialog && (
        <GroupAutoMatchDialog
          open={!!groupForMatchDialog}
          onOpenChange={(open) => !open && setGroupForMatchDialog(null)}
          group={groupForMatchDialog}
        />
      )}
    </div>
  );
}
