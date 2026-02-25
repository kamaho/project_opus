import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasCompletedOnboarding } from "@/lib/ai/onboarding";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    const completed = await hasCompletedOnboarding(userId);
    redirect(completed ? "/dashboard" : "/onboarding");
  }

  redirect("/sign-in");
}
