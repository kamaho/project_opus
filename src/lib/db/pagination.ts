/**
 * Cursor-based pagination utilities.
 *
 * At 100k+ rows, OFFSET-based pagination degrades linearly.
 * Cursor pagination uses a keyset (created_at, id) for constant-time paging.
 *
 * Usage:
 *   const { cursor, limit } = parseCursorParams(req.url);
 *   const rows = await db.execute(sql`
 *     SELECT * FROM transactions
 *     WHERE client_id = ${clientId}
 *       ${cursor ? sql`AND (created_at, id) < (${cursor.createdAt}, ${cursor.id})` : sql``}
 *     ORDER BY created_at DESC, id DESC
 *     LIMIT ${limit + 1}
 *   `);
 *   return NextResponse.json(buildCursorResponse(rows, limit));
 */

export interface CursorParams {
  cursor: { createdAt: string; id: string } | null;
  limit: number;
}

export interface CursorResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Parse cursor and limit from URL search params.
 * Cursor format: `${iso_date}|${uuid}` (base64url encoded)
 */
export function parseCursorParams(url: string): CursorParams {
  const params = new URL(url).searchParams;

  let limit = parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10);
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const cursorParam = params.get("cursor");
  if (!cursorParam) {
    return { cursor: null, limit };
  }

  try {
    const decoded = Buffer.from(cursorParam, "base64url").toString("utf-8");
    const sep = decoded.indexOf("|");
    if (sep === -1) return { cursor: null, limit };

    return {
      cursor: {
        createdAt: decoded.slice(0, sep),
        id: decoded.slice(sep + 1),
      },
      limit,
    };
  } catch {
    return { cursor: null, limit };
  }
}

/**
 * Build a cursor response from query results.
 * The query should fetch `limit + 1` rows. If we get more than `limit`,
 * there's a next page and we encode a cursor from the last returned item.
 */
export function buildCursorResponse<T extends { id: string; createdAt: string | Date | null }>(
  rows: T[],
  limit: number
): CursorResponse<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const last = data[data.length - 1];
    const createdAt = last.createdAt instanceof Date
      ? last.createdAt.toISOString()
      : (last.createdAt ?? "");
    nextCursor = Buffer.from(`${createdAt}|${last.id}`, "utf-8").toString("base64url");
  }

  return { data, nextCursor, hasMore };
}
