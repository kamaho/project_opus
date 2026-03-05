import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

const bodySchema = z.object({
  userId: z.string().min(1, "userId kan ikke være tom").nullable(),
});

export const PATCH = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return zodError(parsed.error);

  const { userId } = parsed.data;

  if (userId) {
    try {
      const clerk = await clerkClient();
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: tenantId,
      });
      const isMember = memberships.data.some(
        (m) => m.publicUserData?.userId === userId
      );
      if (!isMember) {
        return NextResponse.json({ error: "Brukeren er ikke medlem av organisasjonen" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Kunne ikke verifisere brukermedlemskap" }, { status: 500 });
    }
  }

  await db
    .update(clients)
    .set({ assignedUserId: userId })
    .where(eq(clients.id, clientId));

  return NextResponse.json({ ok: true, assignedUserId: userId });
});
