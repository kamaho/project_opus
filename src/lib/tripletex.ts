import { db } from "@/lib/db";
import { tripletexConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt, isEncrypted } from "@/lib/crypto";
import { createHash } from "crypto";

const ENV_BASE_URL = process.env.TRIPLETEX_API_BASE_URL;
const ENV_CONSUMER_TOKEN = process.env.TRIPLETEX_CONSUMER_TOKEN;
const ENV_EMPLOYEE_TOKEN = process.env.TRIPLETEX_EMPLOYEE_TOKEN;

const REQUEST_TIMEOUT_MS = 30_000;
const SESSION_TIMEOUT_MS = 15_000;

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
  const cacheKey = createHash("sha256")
    .update(`${baseUrl}:${consumerToken}:${employeeToken}`)
    .digest("hex");
  const cached = getCachedSession(cacheKey);
  if (cached) return cached;

  const expirationDate = tomorrow();

  const sessionUrl = new URL(`${baseUrl}/token/session/:create`);
  sessionUrl.searchParams.set("consumerToken", consumerToken);
  sessionUrl.searchParams.set("employeeToken", employeeToken);
  sessionUrl.searchParams.set("expirationDate", expirationDate);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(sessionUrl.toString(), { method: "PUT", signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Tripletex session creation timed out after ${SESSION_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

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
        consumerToken: isEncrypted(conn.consumerToken)
          ? decrypt(conn.consumerToken)
          : conn.consumerToken,
        employeeToken: isEncrypted(conn.employeeToken)
          ? decrypt(conn.employeeToken)
          : conn.employeeToken,
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
// Retry + error mapping
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TripletexError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = "TripletexError";
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "Ugyldig forespørsel til Tripletex. Sjekk konfigurasjonen.",
  401: "Tripletex-autentisering feilet. Sjekk at tokenene er korrekte.",
  403: "Ingen tilgang. Sjekk at brukerrettigheter er satt opp i Tripletex.",
  404: "Ressursen ble ikke funnet i Tripletex. Sjekk kontokonfigurasjonen.",
  429: "For mange forespørsler til Tripletex. Prøv igjen om litt.",
  500: "Tripletex-serveren svarte med en feil. Prøv igjen senere.",
  502: "Kunne ikke nå Tripletex. Prøv igjen senere.",
  503: "Tripletex er midlertidig utilgjengelig. Prøv igjen senere.",
};

function mapTripletexError(status: number, path: string, body: string): TripletexError {
  const userMessage = STATUS_MESSAGES[status] ?? "Noe gikk galt med Tripletex-tilkoblingen.";
  return new TripletexError(
    `Tripletex ${path} failed (${status}): ${body.slice(0, 500)}`,
    status,
    userMessage
  );
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
 * Retries transient errors (429, 5xx) with exponential backoff (max 3 attempts).
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

  const method = opts.method ?? "GET";
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      if (res.ok) {
        return res.json() as Promise<T>;
      }

      const body = await res.text();

      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        lastError = mapTripletexError(res.status, opts.path, body);
        await sleep(retryDelay(attempt));
        continue;
      }

      throw mapTripletexError(res.status, opts.path, body);
    } catch (err) {
      if (err instanceof TripletexError) throw err;

      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error(`Tripletex ${method} ${opts.path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
        if (attempt < MAX_RETRIES) {
          await sleep(retryDelay(attempt));
          continue;
        }
        throw new TripletexError(
          lastError.message,
          0,
          "Tripletex-forespørselen tok for lang tid. Prøv igjen."
        );
      }

      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(retryDelay(attempt));
        continue;
      }

      throw new TripletexError(
        `Tripletex ${method} ${opts.path} network error: ${lastError.message}`,
        0,
        "Kunne ikke koble til Tripletex. Sjekk internettforbindelsen og prøv igjen."
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("Tripletex request failed after retries");
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
