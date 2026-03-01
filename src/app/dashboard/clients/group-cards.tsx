"use client";

import { useCallback, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  FolderOpen,
  FileText,
  Zap,
  Plus,
  Palette,
  Briefcase,
  Building2,
  Users,
  LayoutGrid,
  Bookmark,
  PieChart,
  MoreVertical,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ClientGroup } from "./accounts-table";

const GROUP_ICONS: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: "folder", Icon: FolderOpen, label: "Mappe" },
  { key: "briefcase", Icon: Briefcase, label: "Portefølje" },
  { key: "building", Icon: Building2, label: "Bygning" },
  { key: "users", Icon: Users, label: "Personer" },
  { key: "grid", Icon: LayoutGrid, label: "Rutenett" },
  { key: "bookmark", Icon: Bookmark, label: "Bokmerke" },
  { key: "chart", Icon: PieChart, label: "Diagram" },
];

const DEFAULT_ICON_KEY = "folder";

function getGroupIcon(group: ClientGroup): LucideIcon {
  const found = GROUP_ICONS.find((i) => i.key === group.icon);
  return found ? found.Icon : FolderOpen;
}

const GROUP_COLORS = [
  { value: null, label: "Ingen" },
  { value: "#94a3b8", label: "Grå" },
  { value: "#3b82f6", label: "Blå" },
  { value: "#22c55e", label: "Grønn" },
  { value: "#eab308", label: "Gul" },
  { value: "#f97316", label: "Oransje" },
  { value: "#a855f7", label: "Lilla" },
  { value: "#ec4899", label: "Rosa" },
] as const;

interface GroupCardsProps {
  groups: ClientGroup[];
  onOpenGroup: (group: ClientGroup) => void;
  onReport: (group: ClientGroup) => void;
  onSmartMatch: (group: ClientGroup) => void;
  onCreateGroup: () => void;
  onEditGroup?: (group: ClientGroup) => void;
  onDeleteGroup?: (group: ClientGroup) => void;
  onGroupUpdated?: () => void;
}

export function GroupCards({
  groups,
  onOpenGroup,
  onReport,
  onSmartMatch,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
  onGroupUpdated,
}: GroupCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <PlaceholderCard onClick={onCreateGroup} />
      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          onOpen={onOpenGroup}
          onReport={onReport}
          onSmartMatch={onSmartMatch}
          onEdit={onEditGroup}
          onDelete={onDeleteGroup}
          onGroupUpdated={onGroupUpdated}
        />
      ))}
    </div>
  );
}

function PlaceholderCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 transition-colors",
        "hover:border-muted-foreground/50 hover:bg-muted/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label="Opprett ny gruppe"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Plus className="h-6 w-6 text-muted-foreground" />
      </div>
      <span className="mt-3 text-sm font-medium text-muted-foreground">
        Ny gruppe
      </span>
    </button>
  );
}

function GroupCard({
  group,
  onOpen,
  onReport,
  onSmartMatch,
  onEdit,
  onDelete,
  onGroupUpdated,
}: {
  group: ClientGroup;
  onOpen: (g: ClientGroup) => void;
  onReport: (g: ClientGroup) => void;
  onSmartMatch: (g: ClientGroup) => void;
  onEdit?: (g: ClientGroup) => void;
  onDelete?: (g: ClientGroup) => void;
  onGroupUpdated?: () => void;
}) {
  const { memberships } = useOrganization({ memberships: { pageSize: 50 } });
  const members = (memberships?.data ?? []).map((m) => {
    const pub = m.publicUserData;
    return {
      id: pub?.userId ?? "",
      name: [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || "Ukjent",
      imageUrl: pub?.imageUrl ?? undefined,
    };
  });
  const assigned = group.assignedUserId
    ? members.find((m) => m.id === group.assignedUserId)
    : null;

  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [savingIcon, setSavingIcon] = useState(false);

  const count = group.members.length;
  const GroupIcon = getGroupIcon(group);
  const handleOpen = useCallback(() => onOpen(group), [group, onOpen]);
  const handleReport = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReport(group);
    },
    [group, onReport]
  );
  const handleSmartMatch = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSmartMatch(group);
    },
    [group, onSmartMatch]
  );

  const handleColorSelect = useCallback(
    async (value: string | null) => {
      setSavingColor(true);
      try {
        await fetch(`/api/client-groups/${group.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ color: value }),
        });
        setColorPopoverOpen(false);
        onGroupUpdated?.();
      } finally {
        setSavingColor(false);
      }
    },
    [group.id, onGroupUpdated]
  );

  const handleIconSelect = useCallback(
    async (iconKey: string) => {
      setSavingIcon(true);
      try {
        await fetch(`/api/client-groups/${group.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icon: iconKey }),
        });
        setIconPopoverOpen(false);
        onGroupUpdated?.();
      } finally {
        setSavingIcon(false);
      }
    },
    [group.id, onGroupUpdated]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit?.(group);
    },
    [group, onEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(group);
    },
    [group, onDelete]
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        "flex min-h-[180px] flex-col rounded-lg border bg-card text-left transition-colors",
        "hover:bg-muted/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Color accent bar */}
      <div
        className={cn(
          "h-1 rounded-t-lg",
          !group.color && "bg-muted"
        )}
        style={group.color ? { backgroundColor: group.color } : undefined}
      />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:opacity-90",
                  !group.color && "bg-muted"
                )}
                style={
                  group.color
                    ? { backgroundColor: group.color, color: "#fff" }
                    : undefined
                }
                aria-label="Velg ikon"
              >
                <GroupIcon className="h-5 w-5" style={group.color ? { color: "#fff" } : undefined} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-52 p-2"
              align="start"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Gruppeikon
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {GROUP_ICONS.map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    disabled={savingIcon}
                    onClick={() => handleIconSelect(key)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-colors hover:bg-muted",
                      (group.icon ?? DEFAULT_ICON_KEY) === key
                        ? "border-foreground bg-muted"
                        : "border-transparent"
                    )}
                    title={label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {count} {count === 1 ? "klient" : "klienter"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Velg farge"
                >
                  <Palette className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-48 p-2"
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Gruppefarge
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      disabled={savingColor}
                      onClick={() => handleColorSelect(c.value)}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                        group.color === c.value
                          ? "border-foreground ring-1 ring-foreground/20"
                          : "border-transparent"
                      )}
                      style={
                        c.value
                          ? { backgroundColor: c.value }
                          : { backgroundColor: "var(--muted)" }
                      }
                      title={c.label}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {(onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Gruppemeny"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {onEdit && (
                    <DropdownMenuItem onClick={handleEdit}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Rediger
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Slett
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {assigned && (
              <Avatar className="h-8 w-8 ring-2 ring-background">
                {assigned.imageUrl && (
                  <AvatarImage src={assigned.imageUrl} alt={assigned.name} />
                )}
                <AvatarFallback className="text-xs">
                  {assigned.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleReport}
          >
            <FileText className="h-3.5 w-3.5" />
            Rapport
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleSmartMatch}
          >
            <Zap className="h-3.5 w-3.5" />
            Smart Match
          </Button>
        </div>
      </div>
    </article>
  );
}
