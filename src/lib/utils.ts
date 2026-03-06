import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parse a comma-separated companyId URL param into an array of IDs. */
export function parseCompanyIds(param: string | null | undefined): string[] {
  if (!param) return [];
  return param.split(",").filter(Boolean);
}
