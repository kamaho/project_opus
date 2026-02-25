"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, Receipt, Settings, ChevronDown } from "lucide-react";
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

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, smartInfo: "Dashboard — oversikt over kontoer, status og snarveier." },
  { label: "Kontoer", href: "/dashboard/clients", icon: Wallet, smartInfo: "Kontoer — administrer klienter og deres matching-oppsett." },
  { label: "MVA-avstemming", href: "/dashboard/mva-avstemming", icon: Receipt, smartInfo: "MVA-avstemming — avstem MVA i regnskapet mot MVA-melding fra Altinn." },
  { label: "Innstillinger", href: "/dashboard/settings", icon: Settings, smartInfo: "Innstillinger — konfigurer profil, organisasjon og systemvalg." },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { organization } = useOrganization();

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
                    isActive={pathname === item.href}
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
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <Link href="/dashboard" className="flex items-center">
          <RevizoLogo width={100} height={25} />
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
