import { db } from "@/lib/db";
import { userOnboarding } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
