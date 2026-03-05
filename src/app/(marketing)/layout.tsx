import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Revizo — Full kontroll over regnskapet",
  description:
    "Automatisk avstemming for regnskapsbyråer. Koble til Tripletex eller Visma, og få sanntidsoversikt over alle klienter.",
  openGraph: {
    title: "Revizo — Full kontroll over regnskapet",
    description: "Automatisk avstemming for regnskapsbyråer.",
    url: "https://revizo.ai",
    siteName: "Revizo",
    locale: "nb_NO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

async function AuthAwareNavbar() {
  let isSignedIn = false;
  try {
    const { userId } = await auth();
    isSignedIn = !!userId;
  } catch {
    // Clerk unavailable — show unauthenticated navbar
  }
  return <MarketingNavbar isSignedIn={isSignedIn} />;
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<MarketingNavbar isSignedIn={false} />}>
        <AuthAwareNavbar />
      </Suspense>
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
