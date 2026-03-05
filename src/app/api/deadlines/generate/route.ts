import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { generateDeadlines } from "@/lib/deadlines/generate-deadlines";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

const bodySchema = z.object({
  company_id: z.string().uuid("Må være en gyldig UUID").optional(),
  template_ids: z.array(z.string().uuid("Hver template-ID må være en gyldig UUID")).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Må være YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Må være YYYY-MM-DD"),
}).refine((d) => d.from <= d.to, {
  message: "Fra-dato må være før til-dato",
  path: ["from"],
});

export const POST = withTenant(async (req, { tenantId }) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodError(parsed.error);

  const { company_id, template_ids, from, to } = parsed.data;

  const result = await generateDeadlines({
    tenantId,
    companyId: company_id,
    templateIds: template_ids,
    from,
    to,
  });

  return NextResponse.json(result);
});
