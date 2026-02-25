import { RevizoLogo } from "@/components/ui/revizo-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <RevizoLogo width={160} height={40} />
        <p className="text-sm text-muted-foreground">
          Avstemming for regnskapsfirmaer
        </p>
      </div>
      {children}
    </div>
  );
}
