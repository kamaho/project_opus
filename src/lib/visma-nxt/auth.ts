import { db } from "@/lib/db";
import { vismaNxtConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
import { createHmac } from "crypto";
import type { VnxtTokenResponse } from "./types";

// ---------------------------------------------------------------------------
// Visma Connect OAuth 2.0 endpoints
// ---------------------------------------------------------------------------

const VISMA_AUTHORIZE_URL = "https://connect.visma.com/connect/authorize";
const VISMA_TOKEN_URL = "https://connect.visma.com/connect/token";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "business-graphql-api:access-group-based",
].join(" ");

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function getClientId(): string {
  const id = process.env.VISMA_CLIENT_ID;
  if (!id) throw new Error("VISMA_CLIENT_ID is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.VISMA_CLIENT_SECRET;
  if (!secret) throw new Error("VISMA_CLIENT_SECRET is not set");
  return secret;
}

function getRedirectUri(): string {
  return (
    process.env.VISMA_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/visma-nxt/callback`
  );
}

// ---------------------------------------------------------------------------
// State encoding (CSRF + tenant context)
// ---------------------------------------------------------------------------

const STATE_SEPARATOR = ".";

/**
 * Build a signed state parameter that encodes tenantId for the OAuth callback.
 * Format: base64(tenantId).hmac
 */
export function encodeState(tenantId: string): string {
  const payload = Buffer.from(tenantId, "utf-8").toString("base64url");
  const hmac = createHmac("sha256", getClientSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}${STATE_SEPARATOR}${hmac}`;
}

export function decodeState(state: string): string {
  const sep = state.lastIndexOf(STATE_SEPARATOR);
  if (sep === -1) throw new Error("Invalid state: missing separator");

  const payload = state.slice(0, sep);
  const signature = state.slice(sep + 1);

  const expected = createHmac("sha256", getClientSecret())
    .update(payload)
    .digest("base64url");

  if (signature !== expected) {
    throw new Error("Invalid state: signature mismatch (CSRF check failed)");
  }

  return Buffer.from(payload, "base64url").toString("utf-8");
}

// ---------------------------------------------------------------------------
// OAuth 2.0 Authorization Code Flow
// ---------------------------------------------------------------------------

/**
 * Build the Visma Connect authorization URL.
 * Redirect the user to this URL to initiate the OAuth flow.
 */
export function getAuthorizationUrl(tenantId: string): string {
  const state = encodeState(tenantId);

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16)))
    .toString("base64url");

  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code id_token",
    response_mode: "form_post",
    scope: SCOPES,
    state,
    nonce,
  });

  const url = `${VISMA_AUTHORIZE_URL}?${params.toString()}`;
  console.log("[visma-nxt] Authorization URL:", url);
  return url;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Uses app-level credentials (client_id/client_secret), never tenant-specific.
 */
export async function exchangeCode(code: string): Promise<VnxtTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: getClientId(),
    client_secret: getClientSecret(),
  });

  const res = await fetch(VISMA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Visma token exchange failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  return res.json() as Promise<VnxtTokenResponse>;
}

/**
 * Refresh an expired access token using the stored refresh_token.
 * Updates the tokens in the database for the given tenant.
 */
export async function refreshAccessToken(
  tenantId: string
): Promise<string> {
  const conn = await getConnection(tenantId);
  if (!conn) {
    throw new Error(`No Visma NXT connection found for tenant ${tenantId}`);
  }

  const refreshToken = decryptToken(conn.refreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getClientId(),
    client_secret: getClientSecret(),
  });

  const res = await fetch(VISMA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Visma token refresh failed for tenant ${tenantId} (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const tokens = (await res.json()) as VnxtTokenResponse;

  await db
    .update(vismaNxtConnections)
    .set({
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(vismaNxtConnections.tenantId, tenantId));

  return tokens.access_token;
}

/**
 * Get a valid access token for a tenant. Auto-refreshes if expired.
 * This is the primary entry point for all API calls.
 */
export async function getValidToken(tenantId: string): Promise<string> {
  const conn = await getConnection(tenantId);
  if (!conn) {
    throw new Error(`No Visma NXT connection found for tenant ${tenantId}`);
  }

  const now = new Date();
  const expiresAt = new Date(conn.tokenExpiresAt);
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    return decryptToken(conn.accessToken);
  }

  return refreshAccessToken(tenantId);
}

// ---------------------------------------------------------------------------
// Connection helpers
// ---------------------------------------------------------------------------

/**
 * Save or update a Visma NXT connection after OAuth callback.
 */
export async function saveConnection(
  tenantId: string,
  tokens: VnxtTokenResponse,
  companyNo?: number,
  customerNo?: number
): Promise<void> {
  const now = new Date();

  await db
    .insert(vismaNxtConnections)
    .values({
      tenantId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      companyNo: companyNo ?? null,
      customerNo: customerNo ?? null,
      isActive: true,
      verifiedAt: now,
    })
    .onConflictDoUpdate({
      target: [vismaNxtConnections.tenantId],
      set: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        companyNo: companyNo ?? null,
        customerNo: customerNo ?? null,
        isActive: true,
        verifiedAt: now,
        updatedAt: now,
      },
    });
}

/**
 * Get the stored connection for a tenant, or null if not found.
 */
export async function getConnection(tenantId: string) {
  const [conn] = await db
    .select()
    .from(vismaNxtConnections)
    .where(eq(vismaNxtConnections.tenantId, tenantId))
    .limit(1);

  return conn ?? null;
}

/**
 * Get the Visma companyNo for a tenant.
 */
export async function getCompanyNo(tenantId: string): Promise<number> {
  const conn = await getConnection(tenantId);
  if (!conn?.companyNo) {
    throw new Error(
      `No Visma NXT company configured for tenant ${tenantId}`
    );
  }
  return conn.companyNo;
}

/**
 * Update the companyNo for a tenant (after onboarding company selection).
 */
export async function setCompanyNo(
  tenantId: string,
  companyNo: number
): Promise<void> {
  await db
    .update(vismaNxtConnections)
    .set({ companyNo, updatedAt: new Date() })
    .where(eq(vismaNxtConnections.tenantId, tenantId));
}

/**
 * Disconnect a tenant from Visma NXT.
 */
export async function disconnect(tenantId: string): Promise<void> {
  await db
    .update(vismaNxtConnections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(vismaNxtConnections.tenantId, tenantId));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function decryptToken(stored: string): string {
  return isEncrypted(stored) ? decrypt(stored) : stored;
}
