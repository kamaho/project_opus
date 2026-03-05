import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import {
  notifications,
  aiUserMemory,
  aiConversations,
  userOnboarding,
  tutorialCompletions,
  dashboardConfigs,
  tasks,
  clients,
  clientGroups,
  deadlines,
  transactions,
  auditLogs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

async function verifyWebhook(req: NextRequest): Promise<ClerkWebhookEvent> {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!SIGNING_SECRET) {
    throw new Error("CLERK_WEBHOOK_SIGNING_SECRET is not configured");
  }

  const wh = new Webhook(SIGNING_SECRET);
  const body = await req.text();

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  return wh.verify(body, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  }) as ClerkWebhookEvent;
}

/**
 * Delete all user-owned records and nullify assignment references.
 *
 * Strategy:
 *  - DELETE: records that belong to the user (conversations, memories, etc.)
 *  - SET NULL: assignment fields on org-owned records (tasks, deadlines, etc.)
 *  - KEEP: audit trail fields (createdBy, matchedBy, executedBy) — required for compliance
 */
async function handleUserDeleted(userId: string) {
  await db.transaction(async (tx) => {
    // ── DELETE user-owned records ──
    await tx.delete(aiConversations).where(eq(aiConversations.userId, userId));
    await tx.delete(aiUserMemory).where(eq(aiUserMemory.userId, userId));
    await tx.delete(userOnboarding).where(eq(userOnboarding.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(tutorialCompletions).where(eq(tutorialCompletions.userId, userId));
    await tx.delete(dashboardConfigs).where(eq(dashboardConfigs.userId, userId));

    // ── SET NULL on assignment references ──
    await tx.update(tasks).set({ assigneeId: null }).where(eq(tasks.assigneeId, userId));
    await tx.update(clients).set({ assignedUserId: null }).where(eq(clients.assignedUserId, userId));
    await tx.update(clientGroups).set({ assignedUserId: null }).where(eq(clientGroups.assignedUserId, userId));
    await tx.update(deadlines).set({ assigneeId: null }).where(eq(deadlines.assigneeId, userId));
    await tx.update(transactions).set({ mentionedUserId: null }).where(eq(transactions.mentionedUserId, userId));
    await tx.update(notifications).set({ fromUserId: null }).where(eq(notifications.fromUserId, userId));

    // ── Audit log ──
    await tx.insert(auditLogs).values({
      tenantId: "system",
      userId: "system",
      action: "user.deleted",
      entityType: "user",
      entityId: userId,
      metadata: { deletedAt: new Date().toISOString() },
    });
  });
}

export async function POST(req: NextRequest) {
  let event: ClerkWebhookEvent;
  try {
    event = await verifyWebhook(req);
  } catch (err) {
    console.error("[clerk-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    switch (event.type) {
      case "user.deleted": {
        const userId = event.data.id as string | undefined;
        if (!userId) {
          console.warn("[clerk-webhook] user.deleted event missing user id");
          break;
        }
        console.log(`[clerk-webhook] Processing user.deleted for ${userId}`);
        await handleUserDeleted(userId);
        console.log(`[clerk-webhook] Completed cleanup for user ${userId}`);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[clerk-webhook] Error processing ${event.type}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
