import { db } from "@/lib/db";
import { tripletexConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ENV_BASE_URL = process.env.TRIPLETEX_API_BASE_URL;
const ENV_CONSUMER_TOKEN = process.env.TRIPLETEX_CONSUMER_TOKEN;
const ENV_EMPLOYEE_TOKEN = process.env.TRIPLETEX_EMPLOYEE_TOKEN;

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

interface SessionToken {
  token: string;
  expirationDate: string;
}

interface SessionCacheEntry extends SessionToken {
  cacheKey: string;
}

let sessionCache: SessionCacheEntry[] = [];

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getCachedSession(cacheKey: string): string | null {
  const today = new Date().toISOString().split("T")[0];
  const entry = sessionCache.find(
    (s) => s.cacheKey === cacheKey && s.expirationDate > today
  );
  return entry?.token ?? null;
}

function setCachedSession(cacheKey: string, token: string, expirationDate: string) {
  sessionCache = sessionCache.filter((s) => s.cacheKey !== cacheKey);
  sessionCache.push({ cacheKey, token, expirationDate });
}

/**
 * Creates a Tripletex session token with explicit credentials.
 * Exported for use in the connect API where credentials come from user input.
 */
export async function createTripletexSession(
  baseUrl: string,
  consumerToken: string,
  employeeToken: string
): Promise<string> {
  const cacheKey = `${baseUrl}:${consumerToken}:${employeeToken}`;
  const cached = getCachedSession(cacheKey);
  if (cached) return cached;

  const expirationDate = tomorrow();

  const sessionUrl = new URL(`${baseUrl}/token/session/:create`);
  sessionUrl.searchParams.set("consumerToken", consumerToken);
  sessionUrl.searchParams.set("employeeToken", employeeToken);
  sessionUrl.searchParams.set("expirationDate", expirationDate);

  const res = await fetch(sessionUrl.toString(), { method: "PUT" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Tripletex session creation failed (${res.status}): ${body}`
    );
  }

  const json = await res.json();
  const token: string = json.value?.token;

  if (!token) {
    throw new Error("Tripletex session response missing token");
  }

  setCachedSession(cacheKey, token, expirationDate);
  return token;
}

// ---------------------------------------------------------------------------
// Per-tenant credential resolution
// ---------------------------------------------------------------------------

interface TripletexCredentials {
  baseUrl: string;
  consumerToken: string;
  employeeToken: string;
}

/**
 * Loads Tripletex credentials for a given tenant from the database.
 * Falls back to environment variables if no per-tenant connection exists.
 */
export async function getTripletexCredentials(
  tenantId: string
): Promise<TripletexCredentials> {
  try {
    const [conn] = await db
      .select({
        baseUrl: tripletexConnections.baseUrl,
        consumerToken: tripletexConnections.consumerToken,
        employeeToken: tripletexConnections.employeeToken,
        isActive: tripletexConnections.isActive,
      })
      .from(tripletexConnections)
      .where(eq(tripletexConnections.tenantId, tenantId))
      .limit(1);

    if (conn?.isActive && conn.consumerToken && conn.employeeToken) {
      return {
        baseUrl: conn.baseUrl,
        consumerToken: conn.consumerToken,
        employeeToken: conn.employeeToken,
      };
    }
  } catch {
    // DB lookup failed; fall through to env vars
  }

  if (!ENV_BASE_URL || !ENV_CONSUMER_TOKEN || !ENV_EMPLOYEE_TOKEN) {
    throw new Error(
      "Tripletex ikke konfigurert. Koble til Tripletex under Innstillinger > Integrasjoner."
    );
  }

  return {
    baseUrl: ENV_BASE_URL,
    consumerToken: ENV_CONSUMER_TOKEN,
    employeeToken: ENV_EMPLOYEE_TOKEN,
  };
}

// ---------------------------------------------------------------------------
// Generic request helper
// ---------------------------------------------------------------------------

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface TripletexRequestOptions {
  method?: HttpMethod;
  path: string;
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  /** Use a specific company ID as username (default "0" = token owner's company). */
  companyId?: number;
  /** Tenant ID for per-tenant credential resolution. */
  tenantId?: string;
}

/**
 * Authenticated request to the Tripletex API.
 * Resolves credentials per-tenant if tenantId is provided.
 */
export async function tripletexRequest<T = unknown>(
  opts: TripletexRequestOptions
): Promise<T> {
  let baseUrl: string;
  let sessionToken: string;

  if (opts.tenantId) {
    const creds = await getTripletexCredentials(opts.tenantId);
    baseUrl = creds.baseUrl;
    sessionToken = await createTripletexSession(
      creds.baseUrl,
      creds.consumerToken,
      creds.employeeToken
    );
  } else {
    if (!ENV_BASE_URL || !ENV_CONSUMER_TOKEN || !ENV_EMPLOYEE_TOKEN) {
      throw new Error("Tripletex env vars missing and no tenantId provided");
    }
    baseUrl = ENV_BASE_URL;
    sessionToken = await createTripletexSession(
      ENV_BASE_URL,
      ENV_CONSUMER_TOKEN,
      ENV_EMPLOYEE_TOKEN
    );
  }

  const username = opts.companyId?.toString() ?? "0";
  const basicAuth = Buffer.from(`${username}:${sessionToken}`).toString(
    "base64"
  );

  const url = new URL(`${baseUrl}${opts.path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Basic ${basicAuth}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tripletex ${opts.method ?? "GET"} ${opts.path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export async function tripletexGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | boolean>,
  tenantId?: string
): Promise<T> {
  return tripletexRequest<T>({ method: "GET", path, params, tenantId });
}

export async function tripletexPost<T = unknown>(
  path: string,
  body: unknown,
  tenantId?: string
): Promise<T> {
  return tripletexRequest<T>({ method: "POST", path, body, tenantId });
}

export async function tripletexPut<T = unknown>(
  path: string,
  body: unknown,
  tenantId?: string
): Promise<T> {
  return tripletexRequest<T>({ method: "PUT", path, body, tenantId });
}

export async function tripletexDelete<T = unknown>(
  path: string,
  tenantId?: string
): Promise<T> {
  return tripletexRequest<T>({ method: "DELETE", path, tenantId });
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

interface WhoAmI {
  value?: {
    employee?: { id: number; firstName: string; lastName: string };
    company?: { id: number; name: string };
  };
}

export async function tripletexWhoAmI(tenantId?: string): Promise<WhoAmI> {
  return tripletexGet<WhoAmI>("/token/session/>whoAmI", undefined, tenantId);
}
