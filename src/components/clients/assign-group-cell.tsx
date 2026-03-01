"use client";

import { useState, useCallback } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface OrgMember {
  id: string;
  name: string;
  imageUrl?: string;
}

interface AssignGroupCellProps {
  groupId: string;
  assignedUserId: string | null;
  onAssign: (userId: string | null) => void;
}

export function AssignGroupCell({
  assignedUserId,
  onAssign,
}: AssignGroupCellProps) {
  const [open, setOpen] = useState(false);
  const { memberships } = useOrganization({ memberships: { pageSize: 50 } });

  const members: OrgMember[] = (memberships?.data ?? []).map((m) => {
    const pub = m.publicUserData;
    return {
      id: pub?.userId ?? "",
      name:
        [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || "Ukjent",
      imageUrl: pub?.imageUrl ?? undefined,
    };
  });

  const assigned = assignedUserId
    ? members.find((m) => m.id === assignedUserId)
    : null;

  const handleSelect = useCallback(
    (userId: string | null) => {
      onAssign(userId);
      setOpen(false);
    },
    [onAssign]
  );

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
          {assigned ? (
            <>
              <Avatar size="sm">
                {assigned.imageUrl && (
                  <AvatarImage src={assigned.imageUrl} alt={assigned.name} />
                )}
                <AvatarFallback>{initials(assigned.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[80px]">{assigned.name}</span>
            </>
          ) : (
            <>
              <UserPlus className="h-3 w-3" />
              Tilordne
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        <div className="max-h-48 overflow-y-auto">
          {members.map((m) => (
            <button
              key={m.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors",
                assignedUserId === m.id && "bg-accent"
              )}
              onClick={() =>
                handleSelect(assignedUserId === m.id ? null : m.id)
              }
            >
              <Avatar size="sm">
                {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.name} />}
                <AvatarFallback>{initials(m.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{m.name}</span>
              {assignedUserId === m.id && (
                <X className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
              )}
            </button>
          ))}
          {members.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground text-center">
              Ingen teammedlemmer
            </p>
          )}
        </div>
        {assigned && (
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 border-t mt-1 pt-1.5"
            onClick={() => handleSelect(null)}
          >
            <X className="h-3 w-3" />
            Fjern tilordning
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
