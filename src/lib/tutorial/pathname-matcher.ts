/**
 * Match a pathname against a pattern.
 * Supports * as single-segment wildcard.
 */
export function matchPathname(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;

  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every(
    (seg, i) => seg === "*" || seg === pathParts[i]
  );
}
