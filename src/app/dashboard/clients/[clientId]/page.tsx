import { redirect } from "next/navigation";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  // TODO: Replace with <DashboardShell type="client" clientId={clientId} />
  // when client dashboard modules have real data
  redirect(`/dashboard/clients/${clientId}/matching`);
}
