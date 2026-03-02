function getAdminDomains(): string[] {
  const raw = process.env.ADMIN_DOMAINS ?? "revizo.no";
  return raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isSystemAdmin(
  emailAddress: string | undefined | null
): boolean {
  if (!emailAddress) return false;
  const lower = emailAddress.toLowerCase();
  if (getAdminEmails().includes(lower)) return true;
  const domain = lower.split("@")[1];
  return !!domain && getAdminDomains().includes(domain);
}
