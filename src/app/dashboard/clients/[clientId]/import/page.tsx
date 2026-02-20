import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ImportPageClient } from "./import-page-client";
import { validateClientTenant } from "@/lib/db/tenant";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { orgId } = await auth();
  const { clientId } = await params;
  if (!orgId) notFound();

  const row = await validateClientTenant(clientId, orgId);
  if (!row) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/clients/${clientId}`}>← Tilbake</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">Importer fil — {row.name}</h1>
      <p className="text-muted-foreground">
        Velg Mengde 1 (hovedbok) eller Mengde 2 (bank), last opp en CSV- eller CAMT.053-fil, og bekrefte import.
      </p>
      <ImportPageClient clientId={clientId} />
    </div>
  );
}
