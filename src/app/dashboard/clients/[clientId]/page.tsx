import { redirect } from "next/navigation";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  redirect(`/dashboard/clients/${clientId}/matching`);
}
