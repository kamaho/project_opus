import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../auth", () => ({
  getValidToken: vi.fn().mockResolvedValue("mock-token-initial"),
  getCompanyNo: vi.fn().mockResolvedValue(12345),
  refreshAccessToken: vi.fn().mockResolvedValue("mock-token-refreshed"),
}));

import { query, fetchAllPages, VismaNxtError } from "../client";
import { getValidToken, refreshAccessToken } from "../auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = "org_test";

function jsonResponse(data: unknown, errors?: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data, errors }),
    text: () => Promise.resolve(JSON.stringify({ data, errors })),
    headers: new Headers(),
  };
}

function errorResponse(status: number, body = "error") {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
    headers: new Headers(),
  };
}

function rateLimitResponse(retryAfter?: string) {
  const headers = new Headers();
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return {
    ok: false,
    status: 429,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("rate limited"),
    headers,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(getValidToken).mockResolvedValue("mock-token-initial");
  vi.mocked(refreshAccessToken).mockResolvedValue("mock-token-refreshed");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Successful query
// ---------------------------------------------------------------------------

describe("query — success", () => {
  it("returns data from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      jsonResponse({ users: [{ id: 1 }] })
    ));

    const result = await query<{ users: { id: number }[] }>(
      TENANT, "query { users { id } }"
    );
    expect(result).toEqual({ users: [{ id: 1 }] });
  });

  it("sends Authorization header with tenant token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      jsonResponse({ ok: true })
    ));

    await query(TENANT, "query { test }");

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const headers = fetchCall[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer mock-token-initial");
  });

  it("passes variables in the request body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      jsonResponse({ ok: true })
    ));

    await query(TENANT, "query ($id: Int!) { user(id: $id) }", { id: 42 });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.variables).toEqual({ id: 42 });
  });
});

// ---------------------------------------------------------------------------
// GraphQL errors
// ---------------------------------------------------------------------------

describe("query — GraphQL errors", () => {
  it("throws VismaNxtError with graphqlErrors on error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      jsonResponse(null, [{ message: "Field not found", path: ["user"] }])
    ));

    try {
      await query(TENANT, "query { user }");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(VismaNxtError);
      const e = error as VismaNxtError;
      expect(e.message).toContain("Field not found");
      expect(e.graphqlErrors).toHaveLength(1);
    }
  });

  it("throws when data is null and no errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: null }),
      headers: new Headers(),
    }));

    await expect(query(TENANT, "query { x }")).rejects.toThrow(
      "missing data field"
    );
  });
});

// ---------------------------------------------------------------------------
// Auth error retry (the bug fix)
// ---------------------------------------------------------------------------

describe("query — auth error retry", () => {
  it("refreshes token and retries on UNAUTHENTICATED error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        jsonResponse(null, [{
          message: "Not authenticated",
          extensions: { code: "UNAUTHENTICATED" },
        }])
      )
      .mockResolvedValueOnce(
        jsonResponse({ result: "ok" })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await query(TENANT, "query { test }");

    expect(result).toEqual({ result: "ok" });
    expect(refreshAccessToken).toHaveBeenCalledWith(TENANT);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(secondCallHeaders.Authorization).toBe("Bearer mock-token-refreshed");
  });

  it("retries on 'unauthorized' message (case-insensitive)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        jsonResponse(null, [{ message: "Unauthorized access" }])
      )
      .mockResolvedValueOnce(
        jsonResponse({ ok: true })
      );

    vi.stubGlobal("fetch", fetchMock);

    await query(TENANT, "query { test }");
    expect(refreshAccessToken).toHaveBeenCalledWith(TENANT);
  });

  it("throws after exhausting retries on persistent auth error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(null, [{
        message: "Unauthorized",
        extensions: { code: "UNAUTHENTICATED" },
      }])
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(query(TENANT, "query { test }")).rejects.toThrow(
      "Unauthorized"
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// HTTP error retry
// ---------------------------------------------------------------------------

describe("query — HTTP error retry", () => {
  it("retries on 429 with Retry-After header", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimitResponse("2"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await query(TENANT, "query { test }");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 without Retry-After header", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await query(TENANT, "query { test }");
    expect(result).toEqual({ ok: true });
  });

  it("retries on 500 server error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(500, "Internal Server Error"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await query(TENANT, "query { test }");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 400 client error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      errorResponse(400, "Bad Request")
    ));

    try {
      await query(TENANT, "query { test }");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(VismaNxtError);
      expect((error as VismaNxtError).statusCode).toBe(400);
    }
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries on persistent 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      errorResponse(502, "Bad Gateway")
    ));

    await expect(query(TENANT, "query { test }")).rejects.toThrow("502");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("query — timeout", () => {
  it("retries on AbortError (timeout)", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await query(TENANT, "query { test }");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on persistent timeout", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(query(TENANT, "query { test }")).rejects.toThrow(
      "timed out"
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// fetchAllPages — cursor pagination
// ---------------------------------------------------------------------------

describe("fetchAllPages", () => {
  const GQL = "query ($first: Int, $after: String) { items { id } }";

  function makePage(items: number[], hasNext: boolean, cursor: string | null) {
    return jsonResponse({
      result: {
        totalCount: items.length,
        pageInfo: {
          hasNextPage: hasNext,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: cursor,
        },
        items: items.map((id) => ({ id })),
      },
    });
  }

  it("accumulates items across multiple pages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makePage([1, 2, 3], true, "cursor_a"))
      .mockResolvedValueOnce(makePage([4, 5, 6], true, "cursor_b"))
      .mockResolvedValueOnce(makePage([7], false, null));

    vi.stubGlobal("fetch", fetchMock);

    type Item = { id: number };
    type Data = { result: { totalCount: number; pageInfo: any; items: Item[] } };

    const result = await fetchAllPages<Item, Data>(
      TENANT,
      GQL,
      {},
      (data) => data.result,
      3
    );

    expect(result).toHaveLength(7);
    expect(result.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns empty array when first page is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makePage([], false, null)
    ));

    type Item = { id: number };
    type Data = { result: { totalCount: number; pageInfo: any; items: Item[] } };

    const result = await fetchAllPages<Item, Data>(
      TENANT, GQL, {}, (data) => data.result
    );

    expect(result).toEqual([]);
  });

  it("handles single page (hasNextPage: false)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makePage([1, 2], false, null)
    ));

    type Item = { id: number };
    type Data = { result: { totalCount: number; pageInfo: any; items: Item[] } };

    const result = await fetchAllPages<Item, Data>(
      TENANT, GQL, {}, (data) => data.result
    );

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("passes cursor as 'after' variable on subsequent pages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makePage([1], true, "cursor_x"))
      .mockResolvedValueOnce(makePage([2], false, null));

    vi.stubGlobal("fetch", fetchMock);

    type Item = { id: number };
    type Data = { result: { totalCount: number; pageInfo: any; items: Item[] } };

    await fetchAllPages<Item, Data>(
      TENANT, GQL, { extra: "val" }, (data) => data.result, 1
    );

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(firstBody.variables.first).toBe(1);
    expect(firstBody.variables.after).toBeUndefined();
    expect(firstBody.variables.extra).toBe("val");

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    expect(secondBody.variables.first).toBe(1);
    expect(secondBody.variables.after).toBe("cursor_x");
    expect(secondBody.variables.extra).toBe("val");
  });

  it("stops when endCursor is null even if hasNextPage is true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makePage([1], true, null)
    ));

    type Item = { id: number };
    type Data = { result: { totalCount: number; pageInfo: any; items: Item[] } };

    const result = await fetchAllPages<Item, Data>(
      TENANT, GQL, {}, (data) => data.result
    );

    expect(result).toEqual([{ id: 1 }]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
