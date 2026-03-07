"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Search,
  X,
  Plus,
  Check,
  Lock,
  ArrowLeft,
  UserPlus,
  FolderPlus,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// ── Types ──

export interface AccountSyncRow {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: "ledger" | "bank";
  syncLevel: "balance_only" | "transactions";
  balanceIn: string | null;
  balanceOut: string | null;
  clientId: string | null;
  companyId: string;
}

interface AccountSetupItem {
  account: AccountSyncRow;
  withTransactions: boolean;
}

type FolderStatus = "naming" | "editing" | "importing" | "done";

interface WorkFolder {
  id: string;
  name: string;
  items: AccountSetupItem[];
  status: FolderStatus;
  assignedUserIds: string[];
  colorIndex: number;
}

interface WorkFolderSetupProps {
  accounts: AccountSyncRow[];
  companyId: string;
}

interface OrgMember {
  id: string;
  name: string;
  imageUrl?: string;
}

interface FolderColorSet {
  back: string;
  backTab: string;
  frontGradient: string;
  frontTab: string;
  iconBg: string;
  iconText: string;
}

// ── Color palette ──

const FOLDER_PALETTE: FolderColorSet[] = [
  {
    back: "bg-blue-600",
    backTab: "after:bg-blue-600 before:bg-blue-600",
    frontGradient: "bg-gradient-to-t from-blue-500 to-blue-400",
    frontTab: "after:bg-blue-400 before:bg-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconText: "text-blue-700 dark:text-blue-400",
  },
  {
    back: "bg-amber-600",
    backTab: "after:bg-amber-600 before:bg-amber-600",
    frontGradient: "bg-gradient-to-t from-amber-500 to-amber-400",
    frontTab: "after:bg-amber-400 before:bg-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconText: "text-amber-700 dark:text-amber-400",
  },
  {
    back: "bg-violet-600",
    backTab: "after:bg-violet-600 before:bg-violet-600",
    frontGradient: "bg-gradient-to-t from-violet-500 to-violet-400",
    frontTab: "after:bg-violet-400 before:bg-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
    iconText: "text-violet-700 dark:text-violet-400",
  },
  {
    back: "bg-rose-600",
    backTab: "after:bg-rose-600 before:bg-rose-600",
    frontGradient: "bg-gradient-to-t from-rose-500 to-rose-400",
    frontTab: "after:bg-rose-400 before:bg-rose-400",
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
    iconText: "text-rose-700 dark:text-rose-400",
  },
  {
    back: "bg-cyan-600",
    backTab: "after:bg-cyan-600 before:bg-cyan-600",
    frontGradient: "bg-gradient-to-t from-cyan-500 to-cyan-400",
    frontTab: "after:bg-cyan-400 before:bg-cyan-400",
    iconBg: "bg-cyan-100 dark:bg-cyan-900/40",
    iconText: "text-cyan-700 dark:text-cyan-400",
  },
  {
    back: "bg-teal-600",
    backTab: "after:bg-teal-600 before:bg-teal-600",
    frontGradient: "bg-gradient-to-t from-teal-500 to-teal-400",
    frontTab: "after:bg-teal-400 before:bg-teal-400",
    iconBg: "bg-teal-100 dark:bg-teal-900/40",
    iconText: "text-teal-700 dark:text-teal-400",
  },
  {
    back: "bg-indigo-600",
    backTab: "after:bg-indigo-600 before:bg-indigo-600",
    frontGradient: "bg-gradient-to-t from-indigo-500 to-indigo-400",
    frontTab: "after:bg-indigo-400 before:bg-indigo-400",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
    iconText: "text-indigo-700 dark:text-indigo-400",
  },
  {
    back: "bg-orange-600",
    backTab: "after:bg-orange-600 before:bg-orange-600",
    frontGradient: "bg-gradient-to-t from-orange-500 to-orange-400",
    frontTab: "after:bg-orange-400 before:bg-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/40",
    iconText: "text-orange-700 dark:text-orange-400",
  },
];

const LOCKED_COLORS: Omit<FolderColorSet, "iconBg" | "iconText"> = {
  back: "bg-zinc-300 dark:bg-zinc-600",
  backTab: "after:bg-zinc-300 before:bg-zinc-300 dark:after:bg-zinc-600 dark:before:bg-zinc-600",
  frontGradient: "bg-gradient-to-b from-zinc-400 to-zinc-500 dark:from-zinc-500 dark:to-zinc-600",
  frontTab: "after:bg-gradient-to-b after:from-zinc-400 after:to-zinc-400 before:bg-zinc-400 dark:after:from-zinc-500 dark:after:to-zinc-500 dark:before:bg-zinc-500",
};

function getFolderColors(index: number): FolderColorSet {
  return FOLDER_PALETTE[index % FOLDER_PALETTE.length];
}

// ── Helpers ──

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

let _folderId = 0;
function nextFolderId() {
  return `folder-${++_folderId}-${Date.now()}`;
}

// ── AssigneePopover ──

function AssigneePopover({
  members,
  assignedUserIds,
  onToggle,
}: {
  members: OrgMember[];
  assignedUserIds: string[];
  onToggle: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const assignedSet = new Set(assignedUserIds);
  const assignedMembers = members.filter((m) => assignedSet.has(m.id));
  const visible = assignedMembers.slice(0, 3);
  const overflow = assignedMembers.length - 3;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors",
            "hover:bg-muted/60",
            assignedMembers.length === 0 && "text-muted-foreground"
          )}
        >
          {assignedMembers.length > 0 ? (
            <div className="flex items-center">
              <div className="flex -space-x-1.5">
                {visible.map((m) => (
                  <Avatar key={m.id} size="sm" className="ring-2 ring-background">
                    {m.imageUrl && (
                      <AvatarImage src={m.imageUrl} alt={m.name} />
                    )}
                    <AvatarFallback>{initials(m.name)}</AvatarFallback>
                  </Avatar>
                ))}
                {overflow > 0 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-background">
                    +{overflow}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Ansvarlig</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-48 overflow-y-auto">
          {members.map((m) => {
            const isSelected = assignedSet.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors",
                  isSelected && "bg-accent"
                )}
                onClick={() => onToggle(m.id)}
              >
                <Avatar size="sm">
                  {m.imageUrl && (
                    <AvatarImage src={m.imageUrl} alt={m.name} />
                  )}
                  <AvatarFallback>{initials(m.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{m.name}</span>
                {isSelected && (
                  <Check className="h-3 w-3 ml-auto shrink-0 text-primary" />
                )}
              </button>
            );
          })}
          {members.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground text-center">
              Ingen teammedlemmer
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main component ──

export function WorkFolderSetup({
  accounts,
  companyId,
}: WorkFolderSetupProps) {
  const router = useRouter();
  const { memberships } = useOrganization({ memberships: { pageSize: 50 } });
  const { userId: currentUserId } = useAuth();
  const [importing, setImporting] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");
  const [unlockConfirmId, setUnlockConfirmId] = useState<string | null>(null);
  const [folders, setFolders] = useState<WorkFolder[]>([]);
  const colorCounter = useRef(0);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Animation state
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid");
  const animTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ANIM_DURATION = 400;

  const openFolder = useCallback((folderId: string) => {
    if (animTimeout.current) clearTimeout(animTimeout.current);
    setActiveFolderId(folderId);
    requestAnimationFrame(() => {
      setViewMode("detail");
    });
  }, []);

  const closeFolder = useCallback(() => {
    if (animTimeout.current) clearTimeout(animTimeout.current);
    setViewMode("grid");
    animTimeout.current = setTimeout(() => {
      setActiveFolderId(null);
    }, ANIM_DURATION);
  }, []);

  useEffect(() => {
    return () => {
      if (animTimeout.current) clearTimeout(animTimeout.current);
    };
  }, []);

  const members: OrgMember[] = useMemo(
    () =>
      (memberships?.data ?? []).map((m) => {
        const pub = m.publicUserData;
        return {
          id: pub?.userId ?? "",
          name:
            [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") ||
            "Ukjent",
          imageUrl: pub?.imageUrl ?? undefined,
        };
      }),
    [memberships?.data]
  );

  const activeFolder = activeFolderId
    ? folders.find((f) => f.id === activeFolderId) ?? null
    : null;

  const updateFolder = useCallback(
    (folderId: string, updater: (f: WorkFolder) => WorkFolder) => {
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? updater(f) : f))
      );
    },
    []
  );

  // ── Create new folder ──

  const handleCreateFolder = () => {
    const id = nextFolderId();
    const ci = colorCounter.current++;
    const newFolder: WorkFolder = {
      id,
      name: "",
      items: [],
      status: "naming",
      assignedUserIds: [],
      colorIndex: ci,
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  // ── Open / Unlock ──

  const handleOpenFolder = (folderId: string) => {
    const f = folders.find((fl) => fl.id === folderId);
    if (!f) return;
    if (f.status === "importing" || f.status === "done") {
      setUnlockConfirmId(folderId);
      return;
    }
    if (f.status === "naming") {
      openFolder(folderId);
      setTimeout(() => nameInputRef.current?.focus(), ANIM_DURATION + 50);
      return;
    }
    setAddSearch("");
    openFolder(folderId);
  };

  const handleUnlockConfirm = (folderId: string) => {
    updateFolder(folderId, (f) => ({ ...f, status: "editing" }));
    setUnlockConfirmId(null);
    setAddSearch("");
    openFolder(folderId);
  };

  const handleBackToGrid = () => {
    if (activeFolderId) {
      const f = folders.find((fl) => fl.id === activeFolderId);
      if (f?.status === "naming" && f.name.trim() === "" && f.items.length === 0) {
        setFolders((prev) => prev.filter((fl) => fl.id !== activeFolderId));
      } else if (f?.status === "naming" && f.name.trim() !== "") {
        updateFolder(activeFolderId, (prev) => ({ ...prev, status: "editing" }));
      }
    }
    setAddSearch("");
    closeFolder();
  };

  // ── Name confirmed → editing ──

  const handleNameConfirm = () => {
    if (!activeFolderId) return;
    const f = folders.find((fl) => fl.id === activeFolderId);
    if (f && f.name.trim() !== "" && f.status === "naming") {
      updateFolder(activeFolderId, (prev) => ({ ...prev, status: "editing" }));
    }
  };

  // ── Account manipulation ──

  const removeAccount = (folderId: string, accountNumber: string) => {
    updateFolder(folderId, (f) => ({
      ...f,
      items: f.items.filter(
        (item) => item.account.accountNumber !== accountNumber
      ),
    }));
  };

  const addAccount = (folderId: string, account: AccountSyncRow) => {
    updateFolder(folderId, (f) => {
      if (f.items.some((i) => i.account.accountNumber === account.accountNumber))
        return f;
      return {
        ...f,
        items: [...f.items, { account, withTransactions: true }],
      };
    });
  };

  const toggleTransactions = (folderId: string, accountNumber: string) => {
    updateFolder(folderId, (f) => ({
      ...f,
      items: f.items.map((i) =>
        i.account.accountNumber === accountNumber
          ? { ...i, withTransactions: !i.withTransactions }
          : i
      ),
    }));
  };

  const toggleAllTransactions = (folderId: string, checked: boolean) => {
    updateFolder(folderId, (f) => ({
      ...f,
      items: f.items.map((i) => ({ ...i, withTransactions: checked })),
    }));
  };

  // ── Search ──

  const usedAccountNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const f of folders) {
      for (const i of f.items) set.add(i.account.accountNumber);
    }
    return set;
  }, [folders]);

  const availableToAdd = useMemo(() => {
    if (!activeFolder) return [];
    const inFolder = new Set(
      activeFolder.items.map((i) => i.account.accountNumber)
    );
    const q = addSearch.toLowerCase();
    return accounts
      .filter(
        (a) =>
          !inFolder.has(a.accountNumber) &&
          (q === "" ||
            a.accountNumber.startsWith(q) ||
            a.accountName.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [activeFolder, accounts, addSearch]);

  // ── Lock & Import ──

  const handleLockFolder = useCallback(
    async (folderId: string) => {
      const f = folders.find((fl) => fl.id === folderId);
      if (!f || f.items.length === 0) return;

      setImporting(true);
      updateFolder(folderId, (prev) => ({ ...prev, status: "importing" }));
      closeFolder();

      try {
        const balanceOnly = f.items
          .filter((i) => !i.withTransactions)
          .map((i) => i.account.accountNumber);
        const withTx = f.items
          .filter((i) => i.withTransactions)
          .map((i) => i.account.accountNumber);

        const clientIds: string[] = [];

        for (const batch of [
          { numbers: balanceOnly, level: "balance_only" as const },
          { numbers: withTx, level: "transactions" as const },
        ]) {
          if (batch.numbers.length === 0) continue;
          const res = await fetch(
            `/api/companies/${companyId}/accounts/bulk-activate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accountNumbers: batch.numbers,
                dateFrom: `${new Date().getFullYear()}-01-01`,
                syncLevel: batch.level,
              }),
            },
          );
          if (res.ok) {
            const data = await res.json();
            for (const r of data.results as Array<{
              status: string;
              clientId?: string;
            }>) {
              if (r.clientId) clientIds.push(r.clientId);
            }
          }
        }

        if (clientIds.length >= 2) {
          await fetch("/api/client-groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: f.name,
              clientIds,
            }),
          });
        }

        updateFolder(folderId, (prev) => ({ ...prev, status: "importing" }));
        toast.success(
          `${f.name} — ${clientIds.length} kontoer importeres`
        );
        router.refresh();
      } catch {
        updateFolder(folderId, (prev) => ({ ...prev, status: "editing" }));
        toast.error("Noe gikk galt under import");
      } finally {
        setImporting(false);
      }
    },
    [folders, companyId, router, updateFolder, closeFolder]
  );

  // ── Delete folder ──

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeFolderId === folderId) {
      closeFolder();
    }
  };

  // ── Derived state ──

  const isDetail = viewMode === "detail";
  const hasFolders = folders.length > 0;

  // ── No accounts fallback ──

  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Sett opp din arbeidsmappe</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Koble til en integrasjon under{" "}
            <a
              href="/dashboard/integrations"
              className="underline underline-offset-2"
            >
              Integrasjoner
            </a>{" "}
            for å hente kontoplan og saldoer automatisk.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="relative overflow-hidden">
      {/* ── Grid view ── */}
      <div
        className={cn(
          "transition-all ease-in-out origin-top",
          isDetail
            ? "opacity-0 scale-y-[0.97] -translate-y-3 pointer-events-none absolute inset-x-0 top-0"
            : "opacity-100 scale-y-100 translate-y-0 relative"
        )}
        style={{ transitionDuration: `${ANIM_DURATION}ms` }}
      >
        {!hasFolders ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <h3 className="text-xl font-semibold text-foreground">
              Opprett din første arbeidsmappe
            </h3>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">
              Hvilke kontoer og rapporter er du ansvarlig for? Legg dem i
              mappen din, så hjelper vi deg med å automatisere
              arbeidsrutinene dine og holder deg oppdatert på frister og
              gjøremål.
            </p>
            <p className="mt-2 max-w-lg text-xs text-muted-foreground/70 leading-relaxed">
              Du kan også opprette mapper for kollegaer — den som står som
              ansvarlig for en mappe får en skreddersydd opplevelse basert
              på mappens innhold, inkludert varsler, påminnelser og
              tilpassede rapporter.
            </p>
            <button
              type="button"
              onClick={handleCreateFolder}
              className="mt-8 flex h-32 w-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <FolderPlus className="h-8 w-8" />
              <span className="text-xs font-medium">Ny arbeidsmappe</span>
            </button>
          </div>
        ) : (
          /* ── Folders + add button ── */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground max-w-xl">
                Opprett mapper for å organisere kontoene dine. Ansvarlig person
                får varsler og tilpassede rapporter.
              </p>
              {currentUserId && folders.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFolders((prev) =>
                      prev.map((f) =>
                        f.assignedUserIds.includes(currentUserId!)
                          ? f
                          : {
                              ...f,
                              assignedUserIds: [
                                ...f.assignedUserIds,
                                currentUserId!,
                              ],
                            }
                      )
                    );
                    toast.success("Du er nå ansvarlig for alle mapper");
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Sett meg som ansvarlig på alle
                </Button>
              )}
            </div>

            <div className="grid grid-cols-5 gap-x-2 gap-y-8">
              {folders.map((f) => {
                const isDoneOrImporting =
                  f.status === "importing" || f.status === "done";
                const isImporting = f.status === "importing";
                const folderColors = isDoneOrImporting
                  ? LOCKED_COLORS
                  : getFolderColors(f.colorIndex);

                return (
                  <div
                    key={f.id}
                    className="relative flex flex-col items-center animate-in fade-in zoom-in-95 duration-300"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenFolder(f.id)}
                      className={cn(
                        "group relative w-48 h-32 origin-bottom [perspective:1500px] z-10 cursor-pointer",
                        isDoneOrImporting && "opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "w-full h-full origin-top rounded-xl rounded-tl-none transition-all ease duration-300 relative",
                          "after:absolute after:content-[''] after:bottom-[99%] after:left-0 after:w-16 after:h-3 after:rounded-t-xl",
                          "before:absolute before:content-[''] before:-top-[11px] before:left-[60.5px] before:w-3 before:h-3 before:[clip-path:polygon(0_35%,0%_100%,50%_100%)]",
                          folderColors.back,
                          folderColors.backTab,
                          !isDoneOrImporting &&
                            "group-hover:shadow-[0_20px_40px_rgba(0,0,0,.2)]"
                        )}
                      />
                      <div className="absolute inset-1 bg-zinc-400 dark:bg-zinc-500 rounded-xl transition-all ease duration-300 origin-bottom select-none group-hover:[transform:rotateX(-20deg)]" />
                      <div className="absolute inset-1 bg-zinc-300 dark:bg-zinc-400 rounded-xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-30deg)]" />
                      <div className="absolute inset-1 bg-zinc-200 dark:bg-zinc-300 rounded-xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-38deg)]" />
                      <div
                        className={cn(
                          "absolute bottom-0 w-full h-[124px] rounded-xl rounded-tr-none transition-all ease duration-300 origin-bottom flex items-center justify-center",
                          "after:absolute after:content-[''] after:bottom-[99%] after:right-0 after:w-[116px] after:h-[12px] after:rounded-t-xl",
                          "before:absolute before:content-[''] before:-top-[8px] before:right-[113px] before:size-2.5 before:[clip-path:polygon(100%_14%,50%_100%,100%_100%)]",
                          folderColors.frontGradient,
                          folderColors.frontTab,
                          !isDoneOrImporting &&
                            "group-hover:[transform:rotateX(-46deg)_translateY(1px)]"
                        )}
                      >
                        <div className="relative z-10 text-center">
                          <p className="text-xs font-semibold text-white truncate max-w-[10rem] px-2">
                            {f.name || "Ny mappe"}
                          </p>
                          {isImporting ? (
                            <p className="text-[10px] text-white/80 mt-0.5 flex items-center justify-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Importerer...
                            </p>
                          ) : f.status === "done" ? (
                            <p className="text-[10px] text-white/80 mt-0.5 flex items-center justify-center gap-1">
                              <Check className="h-3 w-3" />
                              Ferdig
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/60 mt-0.5">
                              {f.items.length}{" "}
                              {f.items.length === 1 ? "konto" : "kontoer"}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Unlock confirmation */}
                    {unlockConfirmId === f.id && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-52 rounded-lg border bg-card p-3 shadow-lg">
                        <p className="text-xs font-medium text-foreground">
                          Vil du endre denne mappen?
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Mappen importeres. Du kan endre kontoene, men må
                          bekrefte på nytt etterpå.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => setUnlockConfirmId(null)}
                          >
                            Avbryt
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleUnlockConfirm(f.id)}
                          >
                            Ja, endre
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Assignee under folder */}
                    <div className="mt-1.5 w-48">
                      <AssigneePopover
                        members={members}
                        assignedUserIds={f.assignedUserIds}
                        onToggle={(userId) =>
                          updateFolder(f.id, (prev) => ({
                            ...prev,
                            assignedUserIds: prev.assignedUserIds.includes(
                              userId
                            )
                              ? prev.assignedUserIds.filter(
                                  (id) => id !== userId
                                )
                              : [...prev.assignedUserIds, userId],
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}

              {/* Add folder button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="flex h-32 w-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[11px] font-medium">Ny mappe</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail view ── */}
      {activeFolderId && activeFolder && (() => {
        const colors = getFolderColors(activeFolder.colorIndex);
        const isNaming = activeFolder.status === "naming";
        const allChecked =
          activeFolder.items.length > 0 &&
          activeFolder.items.every((i) => i.withTransactions);
        const noneChecked =
          activeFolder.items.length > 0 &&
          activeFolder.items.every((i) => !i.withTransactions);
        const txCount = activeFolder.items.filter(
          (i) => i.withTransactions
        ).length;

        return (
          <div
            className={cn(
              "transition-all ease-in-out origin-top",
              isDetail
                ? "opacity-100 translate-y-0 scale-100 relative"
                : "opacity-0 translate-y-4 scale-[0.98] pointer-events-none absolute inset-x-0 top-0"
            )}
            style={{ transitionDuration: `${ANIM_DURATION}ms` }}
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToGrid}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md",
                    colors.iconBg,
                    colors.iconText
                  )}
                >
                  <FolderPlus className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  {isNaming ? (
                    <Input
                      ref={nameInputRef}
                      placeholder="Gi mappen et navn..."
                      value={activeFolder.name}
                      onChange={(e) =>
                        updateFolder(activeFolderId, (f) => ({
                          ...f,
                          name: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleNameConfirm();
                      }}
                      className={cn(
                        "h-9 text-base font-semibold px-2",
                        activeFolder.name.trim()
                          ? "border-none shadow-none focus-visible:ring-0"
                          : "border-dashed"
                      )}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {activeFolder.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          updateFolder(activeFolderId, (f) => ({
                            ...f,
                            status: "naming",
                          }))
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {activeFolder.items.length}{" "}
                    {activeFolder.items.length === 1 ? "konto" : "kontoer"}{" "}
                    {txCount > 0 && `· ${txCount} med transaksjoner`}
                  </p>
                </div>
                <AssigneePopover
                  members={members}
                  assignedUserIds={activeFolder.assignedUserIds}
                  onToggle={(userId) =>
                    updateFolder(activeFolderId, (f) => ({
                      ...f,
                      assignedUserIds: f.assignedUserIds.includes(userId)
                        ? f.assignedUserIds.filter((id) => id !== userId)
                        : [...f.assignedUserIds, userId],
                    }))
                  }
                />
              </div>

              {/* Help text */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground space-y-1">
                <p>
                  Alle kontoer har allerede saldo. Velg hvilke kontoer denne
                  mappen skal inneholde, og kryss av de som også trenger
                  fullstendig transaksjonshistorikk.
                </p>
                <ul className="list-disc list-inside text-xs space-y-0.5 pl-1">
                  <li>
                    <strong>Avkrysset</strong> — vi henter alle transaksjoner
                    fra regnskapssystemet
                  </li>
                  <li>
                    <strong>Ikke avkrysset</strong> — beholder kun
                    totalsummen (saldo)
                  </li>
                </ul>
              </div>

              {/* Account list */}
              <div className="rounded-lg border overflow-hidden">
                {activeFolder.items.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={
                          allChecked
                            ? true
                            : noneChecked
                              ? false
                              : "indeterminate"
                        }
                        onCheckedChange={(checked) =>
                          toggleAllTransactions(
                            activeFolderId,
                            checked === true
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {allChecked
                          ? "Alle med transaksjoner"
                          : noneChecked
                            ? "Kun saldo på alle"
                            : `${txCount} av ${activeFolder.items.length} med transaksjoner`}
                      </span>
                    </div>
                  </div>
                )}

                {activeFolder.items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Ingen kontoer lagt til ennå. Bruk søket under for å legge
                    til kontoer i mappen.
                  </div>
                ) : (
                  activeFolder.items.map((item, idx) => (
                    <div
                      key={item.account.accountNumber}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5",
                        idx < activeFolder.items.length - 1 && "border-b"
                      )}
                    >
                      <Checkbox
                        checked={item.withTransactions}
                        onCheckedChange={() =>
                          toggleTransactions(
                            activeFolderId,
                            item.account.accountNumber
                          )
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-xs text-muted-foreground w-10 shrink-0">
                            {item.account.accountNumber}
                          </span>
                          <span className="text-sm truncate">
                            {item.account.accountName}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          removeAccount(
                            activeFolderId,
                            item.account.accountNumber
                          )
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}

                {/* Add account search */}
                <div className="border-t px-4 py-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Søk etter kontonummer eller navn..."
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      className="h-8 pl-9 text-sm"
                    />
                  </div>
                  {addSearch && availableToAdd.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {availableToAdd.map((a) => {
                        const usedElsewhere = usedAccountNumbers.has(
                          a.accountNumber
                        );
                        return (
                          <button
                            key={a.accountNumber}
                            type="button"
                            onClick={() => {
                              addAccount(activeFolderId, a);
                              setAddSearch("");
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors",
                              usedElsewhere && "opacity-50"
                            )}
                          >
                            <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-mono tabular-nums text-xs text-muted-foreground w-10 shrink-0">
                              {a.accountNumber}
                            </span>
                            <span className="text-sm truncate">
                              {a.accountName}
                            </span>
                            {usedElsewhere && (
                              <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                i annen mappe
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {addSearch && availableToAdd.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">
                      Ingen treff.
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteFolder(activeFolderId)}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Slett mappe
                </Button>
                <div className="flex items-center gap-3">
                  {activeFolder.name.trim() === "" && activeFolder.items.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Gi mappen et navn for å fortsette
                    </span>
                  )}
                  <Button
                    onClick={() => handleLockFolder(activeFolderId)}
                    disabled={
                      importing ||
                      activeFolder.items.length === 0 ||
                      activeFolder.name.trim() === ""
                    }
                    className="gap-1.5"
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FolderPlus className="h-4 w-4" />
                    )}
                    Opprett mappe
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
