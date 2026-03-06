import { revalidateTag } from "next/cache";

/** Next.js 16 requires a second argument (revalidation profile). */
const REVALIDATE_PROFILE = "max" as const;

export function revalidateCompanies() {
  try {
    revalidateTag("companies", REVALIDATE_PROFILE);
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateClients() {
  try {
    revalidateTag("clients", REVALIDATE_PROFILE);
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateAccounts() {
  try {
    revalidateTag("accounts", REVALIDATE_PROFILE);
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateMatchingRules() {
  try {
    revalidateTag("matching-rules", REVALIDATE_PROFILE);
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateOnboarding() {
  try {
    revalidateTag("onboarding", REVALIDATE_PROFILE);
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidatePlans() {
  try {
    revalidateTag("plans", REVALIDATE_PROFILE);
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateAll() {
  try {
    revalidateTag("companies", REVALIDATE_PROFILE);
    revalidateTag("clients", REVALIDATE_PROFILE);
    revalidateTag("accounts", REVALIDATE_PROFILE);
    revalidateTag("matching-rules", REVALIDATE_PROFILE);
    revalidateTag("onboarding", REVALIDATE_PROFILE);
    revalidateTag("plans", REVALIDATE_PROFILE);
  } catch {
    // revalidation is best-effort
  }
}
