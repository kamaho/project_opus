"use client";

import { useMemo } from "react";
import { useOrganization } from "@clerk/nextjs";

export interface OrgMember {
  id: string;
  name: string;
  imageUrl?: string;
}

/**
 * Shared hook that resolves Clerk org memberships into a stable Map.
 * Use this instead of calling useOrganization({ memberships }) directly
 * in multiple components -- each page gets one Clerk call, and the Map
 * reference is stable across re-renders.
 */
export function useMembersMap() {
  const { memberships, isLoaded } = useOrganization({
    memberships: { pageSize: 100 },
  });

  const membersMap = useMemo(() => {
    const map = new Map<string, OrgMember>();
    for (const m of memberships?.data ?? []) {
      const pub = m.publicUserData;
      const id = pub?.userId ?? "";
      if (!id) continue;
      map.set(id, {
        id,
        name: [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || "Ukjent",
        imageUrl: pub?.imageUrl ?? undefined,
      });
    }
    return map;
  }, [memberships?.data]);

  return { membersMap, membersLoading: !isLoaded };
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
