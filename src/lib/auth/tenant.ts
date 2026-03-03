import { auth } from "@clerk/nextjs/server";

export type OrgRole = "org:admin" | "org:member" | "org:viewer";

export type TenantContext = {
  userId: string;
  tenantId: string;
  role: OrgRole;
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
 */
export async function requireTenant(): Promise<TenantContext> {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    throw new AuthError("Ikke autentisert. Logg inn på nytt.", 401);
  }
  if (!orgId) {
    throw new AuthError("Ingen organisasjon valgt. Velg en organisasjon i headeren.", 403);
  }

  const role = (orgRole as OrgRole) ?? "org:member";

  return { userId, tenantId: orgId, role };
}

/**
 * Sjekker at brukeren har en av de angitte rollene.
 * Kaster AuthError 403 hvis brukeren ikke har tilstrekkelig tilgang.
 */
export function requireRole(ctx: TenantContext, ...allowed: OrgRole[]): void {
  if (!allowed.includes(ctx.role)) {
    throw new AuthError("Utilstrekkelige tilgangsrettigheter.", 403);
  }
}

/**
 * Sjekker at brukeren er admin (org:admin).
 */
export function requireAdmin(ctx: TenantContext): void {
  requireRole(ctx, "org:admin");
}

/**
 * Sjekker at brukeren er admin eller vanlig medlem (ikke viewer).
 */
export function requireMember(ctx: TenantContext): void {
  requireRole(ctx, "org:admin", "org:member");
}
