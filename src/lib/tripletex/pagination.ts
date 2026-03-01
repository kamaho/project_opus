import { tripletexGet } from "@/lib/tripletex";

interface TripletexListResponse<T> {
  fullResultSize: number;
  from: number;
  count: number;
  values: T[];
}

const PAGE_SIZE = 1000;

/**
 * Fetches all pages from a Tripletex list endpoint.
 * Tripletex caps each response at 1000 items — this helper
 * iterates until every record has been retrieved.
 */
export async function fetchAllPages<T>(
  path: string,
  params: Record<string, string | number | boolean> = {},
  tenantId?: string
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await tripletexGet<TripletexListResponse<T>>(path, {
      ...params,
      from,
      count: PAGE_SIZE,
    }, tenantId);

    all.push(...res.values);

    if (all.length >= res.fullResultSize || res.values.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return all;
}
