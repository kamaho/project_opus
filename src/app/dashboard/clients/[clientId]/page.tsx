import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { validateClientTenant } from "@/lib/db/tenant";

export default async function ClientPage({
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
      <h1 className="text-2xl font-semibold">{row.name}</h1>
      <div className="flex gap-4">
        <Button asChild>
          <Link href={`/dashboard/clients/${clientId}/import`}>
            <Upload className="mr-2 h-4 w-4" />
            Importer fil
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/clients/${clientId}/matching`}>Avstemming</Link>
        </Button>
      </div>
      <p className="text-muted-foreground">Last opp filer for Mengde 1 (hovedbok) og Mengde 2 (bank), deretter kjør avstemming.</p>
    </div>
  );
}
