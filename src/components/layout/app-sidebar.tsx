"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Lock, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import dynamic from "next/dynamic";

const SidebarUserBlock = dynamic(
  () => import("@/components/layout/sidebar-user-block").then((m) => m.SidebarUserBlock),
  { ssr: false }
);

import { PlanBadge } from "@/components/layout/plan-badge";
import { UpgradeModal } from "@/components/layout/upgrade-modal";
import {
  NAVIGATION,
  SETTINGS_ITEM,
  TIER_LABELS,
  type NavItem,
  type NavItemTier,
} from "@/lib/constants/navigation";

interface AppSidebarProps {
  plan?: "starter" | "pro" | "enterprise";
  clientCount?: number;
  clientLimit?: number | null;
}

function toNavTier(plan: string): NavItemTier {
  if (plan === "pro") return "PRO";
  if (plan === "enterprise") return "ENTERPRISE";
  return "STARTER";
}

function isActivePath(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function AppSidebar({ plan = "starter", clientCount = 0, clientLimit }: AppSidebarProps) {
  const CURRENT_TIER = toNavTier(plan);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [upgradeTier, setUpgradeTier] = useState<NavItemTier>("PRO");

  const companyIdParam = searchParams.get("companyId");
  const companyQuery = useMemo(
    () => (companyIdParam ? `?companyId=${encodeURIComponent(companyIdParam)}` : ""),
    [companyIdParam]
  );

  const openUpgrade = useCallback((feature: string, tier: NavItemTier) => {
    setUpgradeFeature(feature);
    setUpgradeTier(tier);
    setUpgradeOpen(true);
  }, []);

  function renderItem(item: NavItem) {
    const active = isActivePath(item.href, pathname);

    if (item.status === "LOCKED") {
      return (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            tooltip={item.label}
            className="opacity-50 cursor-pointer"
            onClick={() => openUpgrade(item.label, item.tier)}
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
          <SidebarMenuBadge className="gap-0.5 text-[10px] font-medium opacity-70">
            <Lock className="size-2.5" />
            {TIER_LABELS[item.tier]}
          </SidebarMenuBadge>
        </SidebarMenuItem>
      );
    }

    if (item.status === "COMING_SOON") {
      return (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            asChild
            isActive={active}
            tooltip={item.label}
            className="opacity-60"
          >
            <Link href={`${item.href}${companyQuery}`} data-smart-info={item.smartInfo}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuBadge className="text-[10px] font-medium text-blue-500 dark:text-blue-400">
            Kommer
          </SidebarMenuBadge>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.label}
        >
          <Link href={`${item.href}${companyQuery}`} data-smart-info={item.smartInfo}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border p-3">
          <SidebarUserBlock />
        </SidebarHeader>

        <SidebarContent>
          {NAVIGATION.map((group, i) => (
            <div key={group.label}>
              {i > 0 && <SidebarSeparator />}
              <SidebarGroup>
                <SidebarGroupLabel className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(renderItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          ))}

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(SETTINGS_ITEM.href, pathname)}
                    tooltip={SETTINGS_ITEM.label}
                  >
                    <Link href={`${SETTINGS_ITEM.href}${companyQuery}`} data-smart-info={SETTINGS_ITEM.smartInfo}>
                      <Settings />
                      <span>{SETTINGS_ITEM.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <PlanBadge
            tier={CURRENT_TIER}
            clientCount={clientCount}
            clientLimit={clientLimit ?? null}
          />
        </SidebarFooter>
      </Sidebar>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureName={upgradeFeature}
        requiredTier={upgradeTier}
      />
    </>
  );
}
