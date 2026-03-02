import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3 max-w-sm">
        <p className="text-7xl font-semibold tracking-tight text-foreground/10 select-none font-mono">
          404
        </p>
        <div className="space-y-1.5">
          <p className="font-medium text-foreground">Siden finnes ikke</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sjekk at adressen er riktig, eller gå tilbake til dashbordet.
          </p>
        </div>
      </div>

      <Button asChild>
        <Link href="/dashboard">Gå til dashbordet</Link>
      </Button>
    </div>
  );
}
