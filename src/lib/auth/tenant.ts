import { auth } from "@clerk/nextjs/server";

export type TenantContext = {
  userId: string;
  tenantId: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Henter og validerer tenant-kontekst fra Clerk session.
 * Kaster AuthError hvis bruker ikke er autentisert eller mangler organisasjon.
 *
 * Bruk i ALLE API-ruter og server actions som trenger tenant-tilgang.
 */
export async function requireTenant(): Promise<TenantContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new AuthError("Not authenticated", 401);
  }
  if (!orgId) {
    throw new AuthError("No organization selected", 403);
  }

  return { userId, tenantId: orgId };
}
