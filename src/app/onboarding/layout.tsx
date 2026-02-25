import { RevizoLogo } from "@/components/ui/revizo-logo";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <RevizoLogo width={160} height={40} />
      </div>
      {children}
    </div>
  );
}
