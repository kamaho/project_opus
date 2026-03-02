import { revalidateTag } from "next/cache";

export function revalidateCompanies() {
  try {
    revalidateTag("companies");
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateClients() {
  try {
    revalidateTag("clients");
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateAccounts() {
  try {
    revalidateTag("accounts");
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateMatchingRules() {
  try {
    revalidateTag("matching-rules");
  } catch {
    // revalidation is best-effort; do not fail the request
  }
}

export function revalidateAll() {
  try {
    revalidateTag("companies");
    revalidateTag("clients");
    revalidateTag("accounts");
    revalidateTag("matching-rules");
  } catch {
    // revalidation is best-effort
  }
}
