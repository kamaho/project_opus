"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, Receipt, Settings, ChevronDown, SlidersHorizontal, GraduationCap } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserButton, useUser, useOrganization } from "@clerk/nextjs";
import { NotificationBell } from "@/components/layout/notification-bell";
import { RevizoLogo } from "@/components/ui/revizo-logo";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, smartInfo: "Dashboard — oversikt over avstemminger, status og snarveier." },
  { label: "Avstemminger", href: "/dashboard/clients", icon: Wallet, smartInfo: "Avstemminger — administrer avstemminger og deres matching-oppsett." },
  { label: "Matching-regler", href: "/dashboard/matching-rules", icon: SlidersHorizontal, smartInfo: "Matching-regler — konfigurer regler for automatisk Smart Match." },
  { label: "MVA-avstemming", href: "/dashboard/mva-avstemming", icon: Receipt, smartInfo: "MVA-avstemming — avstem MVA i regnskapet mot MVA-melding fra Altinn." },
  { label: "Innstillinger", href: "/dashboard/settings", icon: Settings, smartInfo: "Innstillinger — konfigurer profil, organisasjon og systemvalg." },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { enabled: tutorialEnabled, setEnabled: setTutorialEnabled } = useTutorialMode();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-3">
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
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.label}
                  >
                    <Link href={item.href} data-smart-info={item.smartInfo}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="tutorial-mode"
            className="text-xs text-sidebar-foreground/80 font-normal cursor-pointer flex items-center gap-1.5"
          >
            <GraduationCap className="h-3.5 w-3.5 text-sidebar-foreground/70" />
            Tutorial-modus
          </Label>
          <Switch
            id="tutorial-mode"
            checked={tutorialEnabled}
            onCheckedChange={setTutorialEnabled}
            aria-label="Slå tutorial-modus av eller på"
          />
        </div>
        <Link href="/dashboard" className="flex items-center">
          <RevizoLogo width={100} height={25} />
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
