import { db } from "@/lib/db";
import { notifications, type NotificationType } from "@/lib/db/schema";
import {
  sendNoteMentionEmail,
  sendSmartMatchEmail,
  sendImportCompletedEmail,
  sendDocumentReceivedEmail,
  sendTaskAssignedEmail,
  sendTaskCompletedEmail,
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
  periodFrom?: string;
  periodTo?: string;
  remainingOpen: number;
  totalItems: number;
}

export async function notifySmartMatchCompleted(params: SmartMatchNotificationParams) {
  const {
    tenantId, userId, clientId, clientName, transactionCount,
    periodFrom, periodTo, remainingOpen, totalItems,
  } = params;

  const pct = totalItems > 0 ? Math.round(((totalItems - remainingOpen) / totalItems) * 100) : 100;

  await createNotification({
    tenantId,
    userId,
    type: "match_completed",
    title: `Smart Match fullført for ${clientName}`,
    body: remainingOpen === 0
      ? `${transactionCount} poster avstemt — alt er tatt! (${pct}%)`
      : `${transactionCount} poster avstemt — ${remainingOpen} gjenstår (${pct}% ferdig)`,
    link: `/dashboard/clients/${clientId}/matching`,
    entityType: "match",
    entityId: clientId,
  });

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    const fullName = user.fullName ?? user.firstName ?? "bruker";
    if (email) {
      await sendSmartMatchEmail({
        toEmail: email,
        userName: fullName,
        clientName,
        transactionCount,
        periodFrom,
        periodTo,
        remainingOpen,
        totalItems,
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

// ---------------------------------------------------------------------------
// Document received (external person uploaded files)
// ---------------------------------------------------------------------------

export interface DocumentReceivedParams {
  tenantId: string;
  requesterId: string;
  contactName: string;
  fileNames: string[];
  clientId?: string | null;
  requestId: string;
}

export async function notifyDocumentReceived(params: DocumentReceivedParams) {
  const { tenantId, requesterId, contactName, fileNames, clientId, requestId } = params;

  const fileList = fileNames.join(", ");

  await createNotification({
    tenantId,
    userId: requesterId,
    type: "system",
    title: "Dokumentasjon mottatt",
    body: `${contactName} har lastet opp: ${fileList}`,
    link: clientId
      ? `/dashboard/clients/${clientId}/matching`
      : "/dashboard/oppgaver",
    entityType: "document_request",
    entityId: requestId,
  });

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(requesterId);
    const email = user.emailAddresses[0]?.emailAddress;
    const userName = user.fullName ?? user.firstName ?? "bruker";
    if (email) {
      await sendDocumentReceivedEmail({
        toEmail: email,
        userName,
        contactName,
        fileNames,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${
          clientId
            ? `/dashboard/clients/${clientId}/matching`
            : "/dashboard/oppgaver"
        }`,
      });
    }
  } catch (e) {
    console.error("[notifications] Failed to send document-received email:", e);
  }
}

// ---------------------------------------------------------------------------
// Task assigned (internal user)
// ---------------------------------------------------------------------------

export interface TaskAssignedParams {
  tenantId: string;
  assigneeId: string;
  assignedByUserId: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  clientId?: string | null;
  clientName?: string | null;
  dueDate?: string | null;
}

export async function notifyTaskAssigned(params: TaskAssignedParams) {
  const {
    tenantId, assigneeId, assignedByUserId, taskId, taskTitle,
    taskDescription, clientId, clientName, dueDate,
  } = params;

  if (assigneeId === assignedByUserId) return;

  await createNotification({
    tenantId,
    userId: assigneeId,
    fromUserId: assignedByUserId,
    type: "assignment",
    title: "Ny oppgave tildelt",
    body: taskTitle,
    link: "/dashboard/oppgaver",
    entityType: "task",
    entityId: taskId,
  });

  try {
    const clerk = await clerkClient();
    const [assignee, assigner] = await Promise.all([
      clerk.users.getUser(assigneeId),
      clerk.users.getUser(assignedByUserId),
    ]);
    const email = assignee.emailAddresses[0]?.emailAddress;
    const assigneeName = assignee.fullName ?? assignee.firstName ?? "bruker";
    const assignerName = assigner.fullName ?? assigner.firstName ?? "En bruker";

    if (email) {
      await sendTaskAssignedEmail({
        toEmail: email,
        assigneeName,
        assignedByName: assignerName,
        taskTitle,
        taskDescription: taskDescription ?? undefined,
        clientName: clientName ?? undefined,
        dueDate: dueDate ?? undefined,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/oppgaver`,
      });
    }
  } catch (e) {
    console.error("[notifications] Failed to send task-assigned email:", e);
  }
}

// ---------------------------------------------------------------------------
// Task completed (notify creator)
// ---------------------------------------------------------------------------

export interface TaskCompletedParams {
  tenantId: string;
  creatorId: string;
  completedByUserId: string;
  taskId: string;
  taskTitle: string;
  clientId?: string | null;
  clientName?: string | null;
}

export async function notifyTaskCompleted(params: TaskCompletedParams) {
  const { tenantId, creatorId, completedByUserId, taskId, taskTitle, clientId, clientName } = params;

  if (creatorId === completedByUserId) return;

  await createNotification({
    tenantId,
    userId: creatorId,
    fromUserId: completedByUserId,
    type: "system",
    title: "Oppgave fullført",
    body: taskTitle,
    link: "/dashboard/oppgaver",
    entityType: "task",
    entityId: taskId,
  });

  try {
    const clerk = await clerkClient();
    const [creator, completer] = await Promise.all([
      clerk.users.getUser(creatorId),
      clerk.users.getUser(completedByUserId),
    ]);
    const email = creator.emailAddresses[0]?.emailAddress;
    const creatorName = creator.fullName ?? creator.firstName ?? "bruker";
    const completerName = completer.fullName ?? completer.firstName ?? "En bruker";

    if (email) {
      await sendTaskCompletedEmail({
        toEmail: email,
        creatorName,
        completedByName: completerName,
        taskTitle,
        clientName: clientName ?? undefined,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/oppgaver`,
      });
    }
  } catch (e) {
    console.error("[notifications] Failed to send task-completed email:", e);
  }
}
