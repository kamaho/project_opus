import { getValidToken, getCompanyNo, refreshAccessToken } from "./auth";
import type { VnxtGraphQLResponse, VnxtPageInfo } from "./types";

// ---------------------------------------------------------------------------
// Visma Business NXT GraphQL Client
// ---------------------------------------------------------------------------

const GRAPHQL_URL = "https://business.visma.net/api/graphql";
const DEFAULT_PAGE_SIZE = 5000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 29_000; // just under Visma's 30s server timeout

export class VismaNxtError extends Error {
  constructor(
    message: string,
    public readonly graphqlErrors?: VnxtGraphQLResponse<unknown>["errors"],
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "VismaNxtError";
  }
}

// ---------------------------------------------------------------------------
// Core query function
// ---------------------------------------------------------------------------

/**
 * Execute a GraphQL query against Visma Business NXT.
 * Handles auth (tenant-scoped token), error parsing, and retry with backoff.
 */
export async function query<T>(
  tenantId: string,
  gqlQuery: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let token = await getValidToken(tenantId);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: gqlQuery, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(
          `[visma-nxt] Rate limited (429), retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new VismaNxtError(
          `GraphQL request failed (${res.status}): ${text.slice(0, 500)}`,
          undefined,
          res.status
        );
      }

      const json = (await res.json()) as VnxtGraphQLResponse<T>;

      if (json.errors?.length) {
        const isAuthError = json.errors.some(
          (e) =>
            e.extensions?.code === "UNAUTHENTICATED" ||
            e.message.toLowerCase().includes("unauthorized")
        );
        if (isAuthError && attempt < MAX_RETRIES - 1) {
          console.warn(
            `[visma-nxt] Auth error, will retry with refreshed token (attempt ${attempt + 1})`
          );
          token = await refreshAccessToken(tenantId);
          continue;
        }

        throw new VismaNxtError(
          `GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
          json.errors
        );
      }

      if (!json.data) {
        throw new VismaNxtError("GraphQL response missing data field");
      }

      return json.data;
    } catch (error) {
      if (error instanceof VismaNxtError) {
        lastError = error;
        if (error.statusCode && error.statusCode >= 500 && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new VismaNxtError("GraphQL request timed out (30s)");
        if (attempt < MAX_RETRIES - 1) continue;
        throw lastError;
      }

      throw error;
    }
  }

  throw lastError ?? new VismaNxtError("All retries exhausted");
}

// ---------------------------------------------------------------------------
// Company-scoped query helper
// ---------------------------------------------------------------------------

/**
 * Execute a query wrapped in useCompany(no: companyNo).
 * The query string must NOT include useCompany — this wraps it automatically.
 */
export async function companyQuery<T>(
  tenantId: string,
  innerQuery: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const companyNo = await getCompanyNo(tenantId);

  const wrappedQuery = `
    query WrappedCompanyQuery($companyNo: Int!) {
      useCompany(no: $companyNo) {
        ${innerQuery}
      }
    }
  `;

  const data = await query<{ useCompany: T }>(tenantId, wrappedQuery, {
    ...variables,
    companyNo,
  });

  return data.useCompany;
}

// ---------------------------------------------------------------------------
// Cursor-based pagination
// ---------------------------------------------------------------------------

interface PaginatedResult<T> {
  items: T[];
  pageInfo: VnxtPageInfo;
  totalCount: number;
}

/**
 * Fetch all pages of a paginated GraphQL query using cursor-based pagination.
 *
 * @param tenantId - Tenant performing the query
 * @param gqlQuery - Full GraphQL query string with $first and $after variables
 * @param variables - Base variables (without pagination vars)
 * @param extractPage - Function to extract the paginated result from the response data
 * @param pageSize - Number of items per page (default: 5000)
 */
export async function fetchAllPages<TItem, TData = unknown>(
  tenantId: string,
  gqlQuery: string,
  variables: Record<string, unknown>,
  extractPage: (data: TData) => PaginatedResult<TItem>,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<TItem[]> {
  const allItems: TItem[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const pageVars: Record<string, unknown> = {
      ...variables,
      first: pageSize,
      ...(cursor ? { after: cursor } : {}),
    };

    const data = await query<TData>(tenantId, gqlQuery, pageVars);
    const page = extractPage(data);

    allItems.push(...page.items);

    hasMore = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;

    if (!hasMore || !cursor) break;
  }

  return allItems;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
