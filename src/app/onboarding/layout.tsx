import Image from "next/image";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { UiPreferencesProvider } from "@/contexts/ui-preferences-context";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UiPreferencesProvider>
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
        <div className="mb-8 flex items-center gap-4">
          <Image
            src="/logo-revizo.svg"
            alt="Revizo"
            width={160}
            height={40}
            className="h-10 w-auto shrink-0"
            priority
          />
          <div className="h-6 w-px bg-border" />
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/onboarding"
            afterSelectOrganizationUrl="/onboarding"
            appearance={{
              elements: {
                rootBox: "flex items-center",
                organizationSwitcherTrigger:
                  "text-sm text-muted-foreground hover:text-foreground transition-colors",
              },
            }}
          />
        </div>
        {children}
      </div>
    </UiPreferencesProvider>
  );
}
