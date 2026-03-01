"use client";

import { ChevronDown } from "lucide-react";
import { UserButton, useUser, useOrganization } from "@clerk/nextjs";
import { NotificationBell } from "@/components/layout/notification-bell";

export function SidebarUserBlock() {
  const { user } = useUser();
  const { organization } = useOrganization();

  return (
    <div className="flex items-center gap-2">
      <UserButton
        afterSignOutUrl="/sign-in"
        appearance={{
          elements: { avatarBox: "h-9 w-9" },
        }}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sidebar-foreground font-medium truncate text-sm">
          {user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "Bruker"}
        </span>
        <span className="text-sidebar-foreground/70 text-xs truncate flex items-center gap-0.5">
          {organization?.name ?? "Velg org"}
          <ChevronDown className="h-3 w-3 shrink-0" />
        </span>
      </div>
      <NotificationBell />
    </div>
  );
}
