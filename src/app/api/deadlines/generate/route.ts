import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { generateDeadlines } from "@/lib/deadlines/generate-deadlines";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const POST = withTenant(async (req, { tenantId }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { company_id, template_ids, from, to } = body as {
    company_id?: string;
    template_ids?: string[];
    from: string;
    to: string;
  };

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }

  if (from > to) {
    return NextResponse.json({ error: "from must be before to" }, { status: 400 });
  }

  const result = await generateDeadlines({
    tenantId,
    companyId: company_id,
    templateIds: template_ids,
    from,
    to,
  });

  return NextResponse.json(result);
});
