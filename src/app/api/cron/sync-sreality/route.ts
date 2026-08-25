import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncSrealityLeads } from "@/lib/sreality";

function checkCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

// Zatím není zapojeno ve vercel.json (crons) – čeká se na reálné S Reality API
// přístupové údaje. Do té doby se synchronizace spouští ručně tlačítkem v /admin/sreality.
export async function GET(request: NextRequest) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: config } = await admin
    .from("sreality_config")
    .select("api_key, api_base_url")
    .eq("id", 1)
    .maybeSingle();

  try {
    const result = await syncSrealityLeads(admin, {
      apiKey: config?.api_key ?? null,
      apiBaseUrl: config?.api_base_url ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chyba při synchronizaci";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
