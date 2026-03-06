"use client";

import { useState, useCallback } from "react";
import { ChevronDown, LogOut, Palette, UserCog } from "lucide-react";
import { useUser, useOrganization, useClerk } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AVATAR_SEEDS, avatarUrl, getAvatarForUser } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function SidebarUserBlock() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const { openUserProfile, signOut } = useClerk();
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const meta = user?.unsafeMetadata as Record<string, unknown> | undefined;
  const avatarSrc = user ? getAvatarForUser(user.id, meta) : avatarUrl("default");
  const currentSeed = typeof meta?.avatarSeed === "string" ? meta.avatarSeed : null;

  const handleSelectAvatar = useCallback(
    async (seed: string) => {
      if (!user || saving) return;
      setSaving(true);
      try {
        await user.update({
          unsafeMetadata: { ...user.unsafeMetadata, avatarSeed: seed },
        });
      } catch (err) {
        console.error("[avatar] Failed to save avatar:", err);
      } finally {
        setSaving(false);
        setAvatarPickerOpen(false);
      }
    },
    [user, saving]
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 min-w-0 flex-1 rounded-md px-1 py-1 -mx-1 transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent focus:outline-none cursor-pointer"
            >
              <img
                src={avatarSrc}
                alt="Profilbilde"
                width={36}
                height={36}
                className="rounded-full shrink-0 bg-muted"
              />
              <div className="flex flex-col min-w-0 flex-1 text-left">
                <span className="text-sidebar-foreground font-medium truncate text-sm">
                  {user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "Bruker"}
                </span>
                <span className="text-sidebar-foreground/70 text-xs truncate flex items-center gap-0.5">
                  {organization?.name ?? "Velg org"}
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="bottom" className="w-56">
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => setAvatarPickerOpen(true)}
            >
              <Palette className="h-4 w-4" />
              Bytt profilbilde
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => openUserProfile()}
            >
              <UserCog className="h-4 w-4" />
              Administrer konto
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              variant="destructive"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
            >
              <LogOut className="h-4 w-4" />
              Logg ut
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationBell />
      </div>

      <Dialog open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Velg profilbilde</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-3 py-4">
            {AVATAR_SEEDS.map((seed) => {
              const src = avatarUrl(seed);
              const active = currentSeed === seed;
              return (
                <button
                  key={seed}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSelectAvatar(seed)}
                  className={cn(
                    "relative rounded-full p-0.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "ring-2 ring-primary"
                      : "ring-1 ring-transparent hover:ring-border"
                  )}
                >
                  <img
                    src={src}
                    alt={seed}
                    width={56}
                    height={56}
                    className="rounded-full bg-muted"
                  />
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
