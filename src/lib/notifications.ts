import { db } from "@/lib/db";
import { notifications, type NotificationType } from "@/lib/db/schema";
import {
  sendNoteMentionEmail,
  sendSmartMatchEmail,
  sendImportCompletedEmail,
} from "@/lib/resend";
import { clerkClient } from "@clerk/nextjs/server";

export interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  fromUserId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  groupKey?: string | null;
}

export async function createNotification(params: CreateNotificationParams) {
  const [row] = await db
    .insert(notifications)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      fromUserId: params.fromUserId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      groupKey: params.groupKey ?? null,
    })
    .returning({ id: notifications.id });

  return row;
}

export async function createBulkNotifications(
  paramsList: CreateNotificationParams[]
) {
  if (paramsList.length === 0) return [];

  const values = paramsList.map((p) => ({
    tenantId: p.tenantId,
    userId: p.userId,
    fromUserId: p.fromUserId ?? null,
    type: p.type,
    title: p.title,
    body: p.body ?? null,
    link: p.link ?? null,
    entityType: p.entityType ?? null,
    entityId: p.entityId ?? null,
    groupKey: p.groupKey ?? null,
  }));

  return db.insert(notifications).values(values).returning({ id: notifications.id });
}

export interface NoteMentionParams {
  tenantId: string;
  fromUserId: string;
  mentionedUserId: string;
  noteText: string;
  clientId: string;
  entityId: string;
  entityDescription?: string;
  groupKey?: string;
}

/**
 * Creates an in-app notification for a note mention.
 * Sends an email only if the mentioned user is someone other than the author.
 */
export async function notifyNoteMention(params: NoteMentionParams) {
  const {
    tenantId,
    fromUserId,
    mentionedUserId,
    noteText,
    clientId,
    entityId,
    entityDescription,
    groupKey,
  } = params;

  const isSelfMention = mentionedUserId === fromUserId;

  await createNotification({
    tenantId,
    userId: mentionedUserId,
    fromUserId,
    type: "note_mention",
    title: isSelfMention
      ? "Du la til et notat med omtale"
      : "Du ble nevnt i et notat",
    body: noteText,
    link: `/dashboard/clients/${clientId}/matching`,
    entityType: "transaction",
    entityId,
    groupKey,
  });

  if (!isSelfMention) {
    try {
      const clerk = await clerkClient();
      const [mentionedUser, fromUser] = await Promise.all([
        clerk.users.getUser(mentionedUserId),
        clerk.users.getUser(fromUserId),
      ]);
      const email = mentionedUser.emailAddresses[0]?.emailAddress;
      const fromName =
        fromUser.fullName ?? fromUser.firstName ?? "En bruker";
      if (email) {
        await sendNoteMentionEmail({
          toEmail: email,
          fromUserName: fromName,
          noteText,
          transactionDescription:
            entityDescription ??
            `Transaksjon ${entityId.slice(0, 8)}`,
          link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/clients/${clientId}/matching`,
        });
      }
    } catch (e) {
      console.error("[notifications] Failed to send mention email:", e);
    }
  }
}

// ---------------------------------------------------------------------------
// Smart Match completed
// ---------------------------------------------------------------------------

export interface SmartMatchNotificationParams {
  tenantId: string;
  userId: string;
  clientId: string;
  clientName: string;
  matchCount: number;
  transactionCount: number;
}

export async function notifySmartMatchCompleted(params: SmartMatchNotificationParams) {
  const { tenantId, userId, clientId, clientName, matchCount, transactionCount } = params;

  await createNotification({
    tenantId,
    userId,
    type: "match_completed",
    title: `Smart Match fullført for ${clientName}`,
    body: `${matchCount} grupper (${transactionCount} transaksjoner) ble automatisk matchet.`,
    link: `/dashboard/clients/${clientId}/matching`,
    entityType: "match",
    entityId: clientId,
  });

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    const userName = user.firstName ?? "bruker";
    if (email) {
      await sendSmartMatchEmail({
        toEmail: email,
        userName,
        clientName,
        matchCount,
        transactionCount,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/clients/${clientId}/matching`,
      });
    }
  } catch (e) {
    console.error("[notifications] Failed to send smart match email:", e);
  }
}

// ---------------------------------------------------------------------------
// Import completed
// ---------------------------------------------------------------------------

export interface ImportNotificationParams {
  tenantId: string;
  userId: string;
  clientId: string;
  clientName: string;
  filename: string;
  recordCount: number;
  setNumber: number;
}

export async function notifyImportCompleted(params: ImportNotificationParams) {
  const { tenantId, userId, clientId, clientName, filename, recordCount, setNumber } = params;
  const setLabel = setNumber === 1 ? "Mengde 1" : "Mengde 2";

  await createNotification({
    tenantId,
    userId,
    type: "import_completed",
    title: `Import fullført for ${clientName}`,
    body: `${filename} — ${recordCount} poster importert til ${setLabel}.`,
    link: `/dashboard/clients/${clientId}/matching`,
    entityType: "import",
    entityId: clientId,
  });

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    const userName = user.firstName ?? "bruker";
    if (email) {
      await sendImportCompletedEmail({
        toEmail: email,
        userName,
        clientName,
        filename,
        recordCount,
        setNumber,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/clients/${clientId}/matching`,
      });
    }
  } catch (e) {
    console.error("[notifications] Failed to send import email:", e);
  }
}
