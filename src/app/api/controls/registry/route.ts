import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { CONTROL_REGISTRY } from "@/lib/controls/registry";

export const GET = withTenant(async () => {
  return NextResponse.json({
    controls: CONTROL_REGISTRY.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      implemented: def.implemented,
      supportedSystems: def.supportedSystems,
      parameters: def.parameters,
    })),
  });
});
