import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SmartPanelProvider } from "@/components/smart-panel/smart-panel-provider";
import { UiPreferencesProvider } from "@/contexts/ui-preferences-context";
import { TutorialModeProvider } from "@/contexts/tutorial-mode-context";
import { TutorialOverlayGate } from "@/components/tutorial/tutorial-overlay-gate";
import { hasCompletedOnboarding } from "@/lib/ai/onboarding";
import { MobileLayoutSwitch } from "@/components/mobile/mobile-layout-switch";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (userId && !(await hasCompletedOnboarding(userId))) {
    redirect("/onboarding");
  }
  return (
    <UiPreferencesProvider>
      <TutorialModeProvider>
        <TutorialOverlayGate>
          <SmartPanelProvider>
            <MobileLayoutSwitch
              desktopShell={
                <SidebarProvider>
                  <AppSidebar />
                  <SidebarInset>
                    <Header />
                    <div className="flex flex-1 flex-col min-h-0 min-w-0 p-2 md:p-4">{children}</div>
                  </SidebarInset>
                </SidebarProvider>
              }
            />
          </SmartPanelProvider>
        </TutorialOverlayGate>
      </TutorialModeProvider>
    </UiPreferencesProvider>
  );
}
