import { revalidateTag } from "next/cache";

const IMMEDIATE = { expire: 0 };

export function revalidateCompanies() {
  revalidateTag("companies", IMMEDIATE);
}

export function revalidateClients() {
  revalidateTag("clients", IMMEDIATE);
}

export function revalidateAccounts() {
  revalidateTag("accounts", IMMEDIATE);
}

export function revalidateMatchingRules() {
  revalidateTag("matching-rules", IMMEDIATE);
}

export function revalidateAll() {
  revalidateTag("companies", IMMEDIATE);
  revalidateTag("clients", IMMEDIATE);
  revalidateTag("accounts", IMMEDIATE);
  revalidateTag("matching-rules", IMMEDIATE);
}
