import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/priser",
  "/personvern",
  "/vilkar",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sign-out",
  "/request-access",
  "/api/health",
  "/api/cron/(.*)",
  "/api/webhooks/(.*)",
  "/d/(.*)",
  "/api/document-requests/public/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const signupMode = process.env.NEXT_PUBLIC_SIGNUP_MODE ?? "open";
  const isSignUp = request.nextUrl.pathname.startsWith("/sign-up");
  if (signupMode === "invite-only" && isSignUp) {
    return NextResponse.redirect(new URL("/request-access", request.url));
  }
  if (!isPublicRoute(request)) {
    await auth.protect();
    if (signupMode === "invite-only") {
      const allowedIdsRaw = process.env.ALLOWED_CLERK_USER_IDS;
      if (allowedIdsRaw) {
        const allowedIds = allowedIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
        const { userId } = await auth();
        if (userId && !allowedIds.includes(userId)) {
          return NextResponse.redirect(new URL("/request-access", request.url));
        }
      }
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|api/auth/visma-nxt/callback|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/auth/visma-nxt/callback)|trpc)(.*)",
  ],
};
