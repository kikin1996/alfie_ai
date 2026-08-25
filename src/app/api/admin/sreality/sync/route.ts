import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncSrealityLeads } from "@/lib/sreality";

function isAdmin(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email === adminEmail;
}

async function resolveEmail(request: NextRequest): Promise<string | undefined> {
  const supabase = await createClient();
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.email;
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.email;
}

export async function POST(request: NextRequest) {
  const email = await resolveEmail(request);
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
