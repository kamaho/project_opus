const DICEBEAR_BASE = "https://api.dicebear.com/9.x/dylan/svg";

/**
 * Curated seeds that produce visually distinct Dylan avatars for the picker.
 */
export const AVATAR_SEEDS = [
  "Nala", "Felix", "Milo", "Luna", "Oscar",
  "Bella", "Leo", "Willow", "Bear", "Pepper",
  "Cleo", "Jasper", "Ruby", "Shadow", "Ginger",
  "Storm", "Maple", "Ziggy", "Olive", "Cosmo",
] as const;

export function avatarUrl(seed: string): string {
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(seed)}`;
}

export function getAvatarForUser(
  userId: string,
  unsafeMetadata?: Record<string, unknown>
): string {
  const stored = unsafeMetadata?.avatarSeed;
  const seed = typeof stored === "string" && stored.length > 0 ? stored : userId;
  return avatarUrl(seed);
}
