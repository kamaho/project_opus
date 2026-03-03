export type WebhookSource = "tripletex" | "visma_nxt" | "poweroffice";

export type WebhookEventType =
  | "transaction.created"
  | "transaction.updated"
  | "transaction.deleted"
  | "account.created"
  | "account.updated"
  | "account.deleted"
  | "connection.revoked"
  | "unknown";

export interface NormalizedWebhookEvent {
  tenantId: string;
  source: WebhookSource;
  eventType: WebhookEventType;
  externalId: string;
  payload: unknown;
}

export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
}

export interface WebhookSourceAdapter {
  readonly source: WebhookSource;
  validateSignature(
    rawBody: Buffer,
    headers: Headers,
    secret: string
  ): WebhookValidationResult;
  normalizeEvents(rawBody: Buffer): NormalizedWebhookEvent[];
  resolveTenantId(
    rawBody: Buffer,
    headers: Headers
  ): Promise<string | null>;
}
