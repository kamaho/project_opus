"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useClerk();
  useEffect(() => {
    signOut({ redirectUrl: "/sign-in" });
  }, [signOut]);
  return (
    <p className="text-sm text-muted-foreground">Logger ut …</p>
  );
}
