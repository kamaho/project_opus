import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

type AuditAction =
  | "import.created"
  | "import.deleted"
  | "import.permanently_deleted"
  | "import.restored"
  | "match.created"
  | "match.deleted"
  | "transaction.created"
  | "transaction.updated"
  | "transaction.deleted"
  | "rule.created"
  | "rule.updated"
  | "rule.deleted";

type AuditEntityType =
  | "import"
  | "transaction"
  | "match"
  | "matching_rule"
  | "client";

interface AuditEntry {
  tenantId: string;
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry) {
  try {
    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch {
    console.error("[audit] Failed to write audit log");
  }
}

/**
 * Batch-version for inserting inside an existing transaction context.
 * Accepts the tx object from db.transaction().
 */
export async function logAuditTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  entry: AuditEntry
) {
  await tx.insert(auditLogs).values({
    tenantId: entry.tenantId,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
}
