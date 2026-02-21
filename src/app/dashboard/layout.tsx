import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SmartPanelProvider } from "@/components/smart-panel/smart-panel-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmartPanelProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <div className="flex flex-1 flex-col min-h-0 p-2 md:p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </SmartPanelProvider>
  );
}
