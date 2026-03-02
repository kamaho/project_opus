"use client";

import { useState } from "react";
import { Sparkles, Bell, FileText, Calendar, Monitor, Scale } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { RevizoLogo } from "@/components/ui/revizo-logo";
import { cn } from "@/lib/utils";
import { MobileAiTab } from "./mobile-ai-tab";
import { MobileNotificationsTab } from "./mobile-notifications-tab";
import { MobileReportsTab } from "./mobile-reports-tab";
import { MobileDeadlineStatus } from "./mobile-deadline-status";
import { MobileReconciliationTab } from "./mobile-reconciliation-tab";

type Tab = "status" | "ai" | "notifications" | "reports" | "deadlines";

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "status", label: "Status", icon: Scale },
  { id: "ai", label: "Revizo AI", icon: Sparkles },
  { id: "notifications", label: "Varsler", icon: Bell },
  { id: "reports", label: "Rapporter", icon: FileText },
  { id: "deadlines", label: "Frister", icon: Calendar },
];

interface MobileShellProps {
  onRequestDesktop: () => void;
}

export function MobileShell({ onRequestDesktop }: MobileShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>("status");

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <RevizoLogo width={90} height={22} />
        <div className="flex items-center gap-2">
          <button
            onClick={onRequestDesktop}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
            title="Bytt til desktop-visning"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden min-[400px]:inline">Desktop</span>
          </button>
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { avatarBox: "h-7 w-7" } }}
          />
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "status" && <MobileReconciliationTab />}
        {activeTab === "ai" && <MobileAiTab />}
        {activeTab === "notifications" && <MobileNotificationsTab />}
        {activeTab === "reports" && <MobileReportsTab />}
        {activeTab === "deadlines" && <MobileDeadlineStatus />}
      </main>

      {/* Bottom tab bar */}
      <nav className="flex h-14 shrink-0 items-stretch border-t bg-background pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors relative",
                isActive
                  ? "text-[oklch(0.62_0.22_280)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-[oklch(0.62_0.22_280)]" />
              )}
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
