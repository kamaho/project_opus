import Image from "next/image";
import { UiPreferencesProvider } from "@/contexts/ui-preferences-context";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UiPreferencesProvider>
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
        <div className="mb-8 flex justify-center">
          <Image
            src="/revizo-logo.png"
            alt="Revizo"
            width={160}
            height={40}
            className="h-10 w-auto shrink-0"
            priority
          />
        </div>
        {children}
      </div>
    </UiPreferencesProvider>
  );
}
