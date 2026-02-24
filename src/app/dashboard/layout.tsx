import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SmartPanelProvider } from "@/components/smart-panel/smart-panel-provider";
import { UiPreferencesProvider } from "@/contexts/ui-preferences-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UiPreferencesProvider>
      <SmartPanelProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Header />
            <div className="flex flex-1 flex-col min-h-0 min-w-0 p-2 md:p-4">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </SmartPanelProvider>
    </UiPreferencesProvider>
  );
}
