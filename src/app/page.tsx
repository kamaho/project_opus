import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasCompletedOnboarding } from "@/lib/ai/onboarding";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    let completed = false;
    try {
      completed = await hasCompletedOnboarding(userId);
    } catch {
      // DB unavailable or misconfigured (e.g. wrong DATABASE_URL in Vercel); send to dashboard so app doesn’t crash
      redirect("/dashboard");
    }
    redirect(completed ? "/dashboard" : "/onboarding");
  }

  redirect("/sign-in");
}
