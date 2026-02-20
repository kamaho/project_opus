"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, Settings, ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserButton, useUser, useOrganization } from "@clerk/nextjs";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Kontoer", href: "/dashboard/clients", icon: Wallet },
  { label: "Innstillinger", href: "/dashboard/settings", icon: Settings },
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
          <div className="flex flex-col min-w-0">
            <span className="text-sidebar-foreground font-medium truncate text-sm">
              {user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "Bruker"}
            </span>
            <span className="text-sidebar-foreground/70 text-xs truncate flex items-center gap-0.5">
              {organization?.name ?? "Velg org"}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </span>
          </div>
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
                    <Link href={item.href}>
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
    </Sidebar>
  );
}
