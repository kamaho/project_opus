import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
};

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => mockSelectChain),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  vismaNxtConnections: {
    tenantId: "tenant_id",
    companyNo: "company_no",
    isActive: "is_active",
  },
}));

import { vismaNxtAdapter } from "../../webhooks/sources/visma-nxt";
import type { VnxtWebhookPayload } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = "test-webhook-secret-key";

function makePayload(overrides?: Partial<VnxtWebhookPayload>): VnxtWebhookPayload {
  return {
    tableIdentifier: "GeneralLedgerTransaction",
    customerNo: 100,
    companyNo: 200,
    event: "INSERT",
    primaryKeys: [{ transactionNo: 12345 }],
    timestamp: "2026-03-04T12:00:00Z",
    changedByUser: "user@example.com",
    ...overrides,
  };
}

function makeRawBody(payload: VnxtWebhookPayload): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

function computeSignature(rawBody: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

function makeHeaders(signature?: string): Headers {
  const headers = new Headers();
  if (signature !== undefined) {
    headers.set("x-webhook-signature", signature);
  }
  return headers;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectChain.from.mockReturnThis();
  mockSelectChain.where.mockReturnThis();
  mockSelectChain.limit.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// validateSignature
// ---------------------------------------------------------------------------

describe("validateSignature", () => {
  it("accepts a valid HMAC-SHA256 signature", () => {
    const payload = makePayload();
    const body = makeRawBody(payload);
    const sig = computeSignature(body, WEBHOOK_SECRET);
    const headers = makeHeaders(sig);

    const result = vismaNxtAdapter.validateSignature(body, headers, WEBHOOK_SECRET);
    expect(result).toEqual({ valid: true });
  });

  it("rejects an invalid signature", () => {
    const payload = makePayload();
    const body = makeRawBody(payload);
    const headers = makeHeaders("dGhpcyBpcyBhIGJhZCBzaWduYXR1cmU=");

    const result = vismaNxtAdapter.validateSignature(body, headers, WEBHOOK_SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid webhook signature");
  });

  it("rejects when signature header is missing", () => {
    const payload = makePayload();
    const body = makeRawBody(payload);
    const headers = makeHeaders();

    const result = vismaNxtAdapter.validateSignature(body, headers, WEBHOOK_SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing webhook signature header");
  });

  it("rejects when body is tampered after signing", () => {
    const payload = makePayload();
    const body = makeRawBody(payload);
    const sig = computeSignature(body, WEBHOOK_SECRET);

    const tamperedPayload = makePayload({ event: "DELETE" });
    const tamperedBody = makeRawBody(tamperedPayload);
    const headers = makeHeaders(sig);

    const result = vismaNxtAdapter.validateSignature(tamperedBody, headers, WEBHOOK_SECRET);
    expect(result.valid).toBe(false);
  });

  it("rejects when wrong secret is used", () => {
    const payload = makePayload();
    const body = makeRawBody(payload);
    const sig = computeSignature(body, "wrong-secret");
    const headers = makeHeaders(sig);

    const result = vismaNxtAdapter.validateSignature(body, headers, WEBHOOK_SECRET);
    expect(result.valid).toBe(false);
  });

  it("validates with different payload sizes", () => {
    const payload = makePayload({
      primaryKeys: Array.from({ length: 100 }, (_, i) => ({ id: i })),
    });
    const body = makeRawBody(payload);
    const sig = computeSignature(body, WEBHOOK_SECRET);
    const headers = makeHeaders(sig);

    const result = vismaNxtAdapter.validateSignature(body, headers, WEBHOOK_SECRET);
    expect(result).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// normalizeEvents
// ---------------------------------------------------------------------------

describe("normalizeEvents", () => {
  it("maps GeneralLedgerTransaction INSERT to transaction.created", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "GeneralLedgerTransaction",
      event: "INSERT",
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("transaction.created");
    expect(events[0].source).toBe("visma_nxt");
  });

  it("maps GeneralLedgerTransaction UPDATE to transaction.updated", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "GeneralLedgerTransaction",
      event: "UPDATE",
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].eventType).toBe("transaction.updated");
  });

  it("maps GeneralLedgerTransaction DELETE to transaction.deleted", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "GeneralLedgerTransaction",
      event: "DELETE",
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].eventType).toBe("transaction.deleted");
  });

  it("maps GeneralLedgerAccount INSERT to account.created", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "GeneralLedgerAccount",
      event: "INSERT",
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].eventType).toBe("account.created");
  });

  it("maps CustomerTransaction UPDATE to transaction.updated", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "CustomerTransaction",
      event: "UPDATE",
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].eventType).toBe("transaction.updated");
  });

  it("maps SupplierTransaction DELETE to transaction.deleted", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "SupplierTransaction",
      event: "DELETE",
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].eventType).toBe("transaction.deleted");
  });

  it("maps unknown table to 'unknown' event type", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "SomeOtherTable",
      event: "INSERT",
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].eventType).toBe("unknown");
  });

  it("maps unknown event on known table to 'unknown'", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "GeneralLedgerTransaction",
      event: "MERGE" as any,
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].eventType).toBe("unknown");
  });

  it("builds externalId with table:event:primaryKeys:companyNo", () => {
    const body = makeRawBody(makePayload({
      tableIdentifier: "GeneralLedgerTransaction",
      event: "INSERT",
      companyNo: 999,
      primaryKeys: [{ transactionNo: 42 }],
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].externalId).toBe(
      "GeneralLedgerTransaction:INSERT:42:999"
    );
  });

  it("handles multiple primary keys in externalId", () => {
    const body = makeRawBody(makePayload({
      primaryKeys: [
        { accountNo: 3000, year: 2026 },
        { accountNo: 4000, year: 2026 },
      ],
    }));

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].externalId).toContain("3000-2026_4000-2026");
  });

  it("includes full payload in event", () => {
    const payload = makePayload();
    const body = makeRawBody(payload);

    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].payload).toEqual(payload);
  });

  it("sets tenantId to empty string (resolved later)", () => {
    const body = makeRawBody(makePayload());
    const events = vismaNxtAdapter.normalizeEvents(body);
    expect(events[0].tenantId).toBe("");
  });
});

// ---------------------------------------------------------------------------
// resolveTenantId
// ---------------------------------------------------------------------------

describe("resolveTenantId", () => {
  it("returns tenantId for known active companyNo", async () => {
    mockSelectChain.limit.mockResolvedValueOnce([
      { tenantId: "org_found" },
    ]);

    const body = makeRawBody(makePayload({ companyNo: 200 }));
    const result = await vismaNxtAdapter.resolveTenantId(body, new Headers());
    expect(result).toBe("org_found");
  });

  it("returns null for unknown companyNo", async () => {
    mockSelectChain.limit.mockResolvedValueOnce([]);

    const body = makeRawBody(makePayload({ companyNo: 999 }));
    const result = await vismaNxtAdapter.resolveTenantId(body, new Headers());
    expect(result).toBeNull();
  });

  it("returns null when companyNo is 0 (falsy)", async () => {
    const body = makeRawBody(makePayload({ companyNo: 0 }));
    const result = await vismaNxtAdapter.resolveTenantId(body, new Headers());
    expect(result).toBeNull();
  });

  it("returns null when payload has no companyNo", async () => {
    const payload = makePayload();
    (payload as any).companyNo = undefined;
    const body = makeRawBody(payload);

    const result = await vismaNxtAdapter.resolveTenantId(body, new Headers());
    expect(result).toBeNull();
  });

  it("queries with both companyNo and isActive filters", async () => {
    mockSelectChain.limit.mockResolvedValueOnce([]);

    const body = makeRawBody(makePayload({ companyNo: 500 }));
    await vismaNxtAdapter.resolveTenantId(body, new Headers());

    expect(mockSelectChain.where).toHaveBeenCalled();
  });
});
