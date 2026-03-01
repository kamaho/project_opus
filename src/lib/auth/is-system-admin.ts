const ADMIN_DOMAINS = ["revizo.no"];
const ADMIN_EMAILS = ["h0lst@icloud.com"];

export function isSystemAdmin(
  emailAddress: string | undefined | null
): boolean {
  if (!emailAddress) return false;
  const lower = emailAddress.toLowerCase();
  if (ADMIN_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1];
  return !!domain && ADMIN_DOMAINS.includes(domain);
}
