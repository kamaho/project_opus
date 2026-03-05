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
import { getTenantPlan, PLAN_LIMITS, type PlanTier } from "@/lib/plans";
import { db } from "@/lib/db";
import { clients, companies } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  const [onboardingDone, plan, clientCountResult] = await Promise.all([
    userId
      ? hasCompletedOnboarding(userId).catch(() => true)
      : Promise.resolve(true),
    orgId
      ? getTenantPlan(orgId).catch(() => "starter" as PlanTier)
      : Promise.resolve("starter" as PlanTier),
    orgId
      ? db
          .select({ value: count() })
          .from(clients)
          .innerJoin(companies, eq(clients.companyId, companies.id))
          .where(eq(companies.tenantId, orgId))
          .then((rows) => rows[0]?.value ?? 0)
          .catch(() => 0)
      : Promise.resolve(0),
  ]);

  if (userId && !onboardingDone) redirect("/onboarding");

  const limits = PLAN_LIMITS[plan];

  return (
    <UiPreferencesProvider>
      <TutorialModeProvider>
        <TutorialOverlayGate>
          <SmartPanelProvider>
            <MobileLayoutSwitch
              desktopShell={
                <SidebarProvider>
                  <AppSidebar
                    plan={plan}
                    clientCount={clientCountResult}
                    clientLimit={limits.maxClients === Infinity ? null : limits.maxClients}
                  />
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
