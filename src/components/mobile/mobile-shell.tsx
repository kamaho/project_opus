"use client";

import { useState } from "react";
import { Home, Users, Calendar, Bell, Sparkles, Monitor } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { RevizoLogo } from "@/components/ui/revizo-logo";
import { cn } from "@/lib/utils";
import { MobileOverviewTab } from "./mobile-overview-tab";
import { MobileReconciliationTab } from "./mobile-reconciliation-tab";
import { MobileDeadlineStatus } from "./mobile-deadline-status";
import { MobileNotificationsTab } from "./mobile-notifications-tab";
import { MobileAiOverlay } from "./mobile-ai-overlay";

type Tab = "oversikt" | "klienter" | "frister" | "varsler";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "oversikt", label: "Oversikt", icon: Home },
  { id: "klienter", label: "Klienter", icon: Users },
  { id: "frister", label: "Frister", icon: Calendar },
  { id: "varsler", label: "Varsler", icon: Bell },
];

interface MobileShellProps {
  onRequestDesktop: () => void;
}

export function MobileShell({ onRequestDesktop }: MobileShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>("oversikt");
  const [showAi, setShowAi] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <RevizoLogo width={90} height={22} />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAi(true)}
            className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted transition-colors"
            title="Revizo AI"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            onClick={onRequestDesktop}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
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
        {activeTab === "oversikt" && (
          <MobileOverviewTab onNavigate={setActiveTab} />
        )}
        {activeTab === "klienter" && <MobileReconciliationTab />}
        {activeTab === "frister" && <MobileDeadlineStatus />}
        {activeTab === "varsler" && <MobileNotificationsTab />}
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
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-foreground" />
              )}
              <tab.icon
                className={cn("h-5 w-5", isActive && "stroke-[2.5]")}
              />
              <span className="text-[10px] font-medium leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* AI overlay */}
      {showAi && <MobileAiOverlay onClose={() => setShowAi(false)} />}
    </div>
  );
}
