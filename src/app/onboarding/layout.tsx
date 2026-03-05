import Image from "next/image";
import { OrganizationSwitcher } from "@clerk/nextjs";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <Image
        src="/logo-revizo.svg"
        alt="Revizo"
        width={160}
        height={40}
        className="h-10 w-auto mb-10"
        priority
      />
      {children}
      <div className="mt-10">
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/onboarding"
          afterSelectOrganizationUrl="/onboarding"
          appearance={{
            elements: {
              rootBox: "flex items-center justify-center",
              organizationSwitcherTrigger:
                "text-sm text-muted-foreground hover:text-foreground transition-colors",
            },
          }}
        />
      </div>
    </div>
  );
}
