import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parse a comma-separated companyId URL param into an array of IDs. Strips the "__none__" sentinel used by the company selector. */
export function parseCompanyIds(param: string | null | undefined): string[] {
  if (!param || param === "__none__") return [];
  return param.split(",").filter((id) => id && id !== "__none__");
}
