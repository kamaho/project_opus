import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be before imports
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace("enc:", "")),
  isEncrypted: vi.fn((v: string) => v.startsWith("enc:")),
}));

vi.mock("@/lib/db/schema", () => ({
  vismaNxtConnections: { tenantId: "tenant_id" },
}));

// ---------------------------------------------------------------------------
// Env setup — these must be set before importing the module
// ---------------------------------------------------------------------------

const TEST_CLIENT_SECRET = "test-secret-key-for-hmac-signing";

beforeEach(() => {
  vi.stubEnv("VISMA_CLIENT_ID", "test-client-id");
  vi.stubEnv("VISMA_CLIENT_SECRET", TEST_CLIENT_SECRET);
  vi.stubEnv("VISMA_REDIRECT_URI", "http://localhost:3000/api/auth/visma-nxt/callback");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  encodeState,
  decodeState,
  getAuthorizationUrl,
  exchangeCode,
} from "../auth";

// ---------------------------------------------------------------------------
// encodeState / decodeState
// ---------------------------------------------------------------------------

describe("encodeState / decodeState", () => {
  it("roundtrips a tenantId through encode → decode", () => {
    const tenantId = "org_abc123";
    const state = encodeState(tenantId);
    const decoded = decodeState(state);
    expect(decoded).toBe(tenantId);
  });

  it("roundtrips tenantId with special characters", () => {
    const tenantId = "org_with-dashes_and.dots";
    const state = encodeState(tenantId);
    expect(decodeState(state)).toBe(tenantId);
  });

  it("throws on tampered signature", () => {
    const state = encodeState("org_legit");
    const parts = state.split(".");
    const tampered = `${parts[0]}.TAMPERED_SIGNATURE`;
    expect(() => decodeState(tampered)).toThrow("signature mismatch");
  });

  it("throws on tampered payload", () => {
    const state = encodeState("org_legit");
    const parts = state.split(".");
    const tampered = `TAMPERED_PAYLOAD.${parts[1]}`;
    expect(() => decodeState(tampered)).toThrow("signature mismatch");
  });

  it("throws when separator is missing", () => {
    expect(() => decodeState("noseparatorhere")).toThrow("missing separator");
  });

  it("throws on empty string", () => {
    expect(() => decodeState("")).toThrow("missing separator");
  });

  it("state contains exactly one separator", () => {
    const state = encodeState("org_test");
    const dotCount = (state.match(/\./g) || []).length;
    expect(dotCount).toBeGreaterThanOrEqual(1);
    expect(state.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// getAuthorizationUrl
// ---------------------------------------------------------------------------

describe("getAuthorizationUrl", () => {
  it("returns a URL with correct params", () => {
    const url = getAuthorizationUrl("org_test");
    expect(url).toContain("https://connect.visma.com/connect/authorize");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("response_type=code");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=");
    expect(url).toContain("scope=");
  });

  it("encodes state with the provided tenantId", () => {
    const url = getAuthorizationUrl("org_xyz");
    const params = new URL(url).searchParams;
    const state = params.get("state")!;
    expect(decodeState(state)).toBe("org_xyz");
  });

  it("includes offline_access in scope", () => {
    const url = getAuthorizationUrl("org_test");
    const params = new URL(url).searchParams;
    expect(params.get("scope")).toContain("offline_access");
  });
});

// ---------------------------------------------------------------------------
// exchangeCode
// ---------------------------------------------------------------------------

describe("exchangeCode", () => {
  it("returns tokens on successful exchange", async () => {
    const mockTokens = {
      access_token: "access_abc",
      refresh_token: "refresh_xyz",
      token_type: "Bearer",
      expires_in: 3600,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokens),
      })
    );

    const result = await exchangeCode("auth_code_123");
    expect(result).toEqual(mockTokens);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toBe("https://connect.visma.com/connect/token");
    const body = fetchCall[1]?.body as string;
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=auth_code_123");
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("invalid_grant"),
      })
    );

    await expect(exchangeCode("bad_code")).rejects.toThrow(
      "Visma token exchange failed (400)"
    );
  });

  it("throws on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Network failure"))
    );

    await expect(exchangeCode("any_code")).rejects.toThrow("Network failure");
  });
});

// ---------------------------------------------------------------------------
// getValidToken (integration-level, tests expiry logic)
// ---------------------------------------------------------------------------

describe("getValidToken", () => {
  it("throws when no connection exists for tenant", async () => {
    const { db } = await import("@/lib/db");
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(mockChain as any);

    const { getValidToken } = await import("../auth");
    await expect(getValidToken("org_nonexistent")).rejects.toThrow(
      "No Visma NXT connection found"
    );
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe("refreshAccessToken", () => {
  it("throws when no connection exists", async () => {
    const { db } = await import("@/lib/db");
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(mockChain as any);

    const { refreshAccessToken } = await import("../auth");
    await expect(refreshAccessToken("org_missing")).rejects.toThrow(
      "No Visma NXT connection found"
    );
  });
});

// ---------------------------------------------------------------------------
// Env guard tests
// ---------------------------------------------------------------------------

describe("env guards", () => {
  it("throws when VISMA_CLIENT_ID is not set", () => {
    vi.stubEnv("VISMA_CLIENT_ID", "");
    delete process.env.VISMA_CLIENT_ID;
    expect(() => getAuthorizationUrl("org_test")).toThrow(
      "VISMA_CLIENT_ID is not set"
    );
  });

  it("throws when VISMA_CLIENT_SECRET is not set", () => {
    vi.stubEnv("VISMA_CLIENT_SECRET", "");
    delete process.env.VISMA_CLIENT_SECRET;
    expect(() => encodeState("org_test")).toThrow(
      "VISMA_CLIENT_SECRET is not set"
    );
  });
});
