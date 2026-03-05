import { NextResponse } from "next/server";
import { exchangeCode, decodeState, saveConnection } from "@/lib/visma-nxt/auth";
import { getCompanies } from "@/lib/visma-nxt/sync";

function redirect303(url: URL): NextResponse {
  return NextResponse.redirect(url, 303);
}

async function handleCallback(request: Request, params: URLSearchParams) {
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const baseUrl = new URL(request.url).origin;

  if (error) {
    const desc = params.get("error_description") ?? error;
    console.error(`[visma-nxt/callback] OAuth error: ${desc}`);
    return redirect303(
      new URL(
        `/dashboard/integrasjoner?error=${encodeURIComponent(desc)}`,
        baseUrl
      )
    );
  }

  if (!code || !state) {
    return redirect303(
      new URL(
        "/dashboard/integrasjoner?error=Mangler%20autorisasjonskode",
        baseUrl
      )
    );
  }

  let tenantId: string;
  try {
    tenantId = decodeState(state);
  } catch (err) {
    console.error("[visma-nxt/callback] Invalid state:", err);
    return redirect303(
      new URL(
        "/dashboard/integrasjoner?error=Ugyldig%20state%20(CSRF)",
        baseUrl
      )
    );
  }

  try {
    const tokens = await exchangeCode(code);
    await saveConnection(tenantId, tokens);

    const companies = await getCompanies(tenantId);

    if (companies.length === 1) {
      const { setCompanyNo } = await import("@/lib/visma-nxt/auth");
      await setCompanyNo(tenantId, companies[0].companyNo);
      return redirect303(
        new URL(
          `/dashboard/integrasjoner?visma_nxt=connected&company=${companies[0].companyName}`,
          baseUrl
        )
      );
    }

    const companiesParam = encodeURIComponent(
      JSON.stringify(
        companies.map((c) => ({
          no: c.companyNo,
          name: c.companyName,
          customer: c.customerNo,
        }))
      )
    );

    return redirect303(
      new URL(
        `/dashboard/integrasjoner?visma_nxt=select_company&companies=${companiesParam}`,
        baseUrl
      )
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[visma-nxt/callback] Token exchange failed:", msg);
    return redirect303(
      new URL(
        `/dashboard/integrasjoner?error=${encodeURIComponent("Tilkobling feilet: " + msg.slice(0, 200))}`,
        baseUrl
      )
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleCallback(request, url.searchParams);
}

export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  return handleCallback(request, params);
}
