export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xl font-semibold tracking-tight">
            Account Control
          </span>
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
        </div>
        <p className="text-sm text-muted-foreground">
          Avstemming for regnskapsfirmaer
        </p>
      </div>
      {children}
    </div>
  );
}
