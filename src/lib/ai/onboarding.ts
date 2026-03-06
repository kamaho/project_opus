import { db } from "@/lib/db";
import { userOnboarding } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export interface OnboardingStatus {
  profileCompleted: boolean;
  firstClientCreated: boolean;
  bankConnected: boolean;
  firstMatchRun: boolean;
  teamInvited: boolean;
  notificationsConfigured: boolean;
  completedAt: Date | null;
}

export async function getOrCreateOnboarding(
  userId: string,
  orgId: string
): Promise<OnboardingStatus> {
  const existing = await db
    .select()
    .from(userOnboarding)
    .where(eq(userOnboarding.userId, userId))
    .limit(1);

  if (existing[0]) {
    return {
      profileCompleted: existing[0].profileCompleted ?? false,
      firstClientCreated: existing[0].firstClientCreated ?? false,
      bankConnected: existing[0].bankConnected ?? false,
      firstMatchRun: existing[0].firstMatchRun ?? false,
      teamInvited: existing[0].teamInvited ?? false,
      notificationsConfigured: existing[0].notificationsConfigured ?? false,
      completedAt: existing[0].completedAt,
    };
  }

  await db.insert(userOnboarding).values({
    userId,
    organizationId: orgId,
  });

  return {
    profileCompleted: false,
    firstClientCreated: false,
    bankConnected: false,
    firstMatchRun: false,
    teamInvited: false,
    notificationsConfigured: false,
    completedAt: null,
  };
}

/** Returns true if the user has completed the welcome onboarding (completedAt set). Does not create a row. */
export const hasCompletedOnboarding = unstable_cache(
  async (userId: string): Promise<boolean> => {
    const row = await db
      .select({ completedAt: userOnboarding.completedAt })
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);
    return row[0]?.completedAt != null;
  },
  ["onboarding-completed"],
  { revalidate: 60, tags: ["onboarding"] }
);

export interface OnboardingCompleteOptions {
  revizoEnabled?: boolean;
  firstClientCreated?: boolean;
  erpConnected?: boolean;
  userType?: string;
  responsibilities?: string[];
}

/** Mark the welcome onboarding as completed. Sets completedAt and optional status flags. */
export async function markOnboardingComplete(
  userId: string,
  orgId: string | null,
  options: OnboardingCompleteOptions = {}
): Promise<void> {
  await getOrCreateOnboarding(userId, orgId ?? userId);
  await db
    .update(userOnboarding)
    .set({
      completedAt: new Date(),
      revizoEnabled: options.revizoEnabled ?? false,
      firstClientCreated: options.firstClientCreated ?? false,
      profileCompleted: true,
      userType: options.userType ?? null,
      responsibilities: options.responsibilities
        ? JSON.stringify(options.responsibilities)
        : null,
    })
    .where(eq(userOnboarding.userId, userId));
}

export function getNextOnboardingStep(
  status: OnboardingStatus
): string | null {
  if (!status.firstClientCreated) {
    return "Neste steg: Opprett din første klient (avstemmingsenhet). Gå til Klienter og klikk \"Ny klient\".";
  }
  if (!status.firstMatchRun) {
    return "Neste steg: Importer transaksjoner og kjør din første matching. Gå til en klient og importer filer.";
  }
  if (!status.bankConnected) {
    return "Tips: Koble til SFTP for automatisk bankimport. Gå til Innstillinger > Bankintegrasjon.";
  }
  if (!status.teamInvited) {
    return "Tips: Inviter kollegaer til organisasjonen for samarbeid.";
  }
  if (!status.notificationsConfigured) {
    return "Tips: Sett opp varsler for å holde oversikt over frister og endringer.";
  }
  return null;
}
