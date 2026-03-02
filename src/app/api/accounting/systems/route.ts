import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { getSupportedSystems } from "@/lib/accounting";

export const GET = withTenant(async () => {
  const systems = getSupportedSystems();
  return NextResponse.json({ systems });
});
