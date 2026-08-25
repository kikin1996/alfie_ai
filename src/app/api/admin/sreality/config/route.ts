import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

export async function GET(request: NextRequest) {
  const email = await resolveEmail(request);
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("sreality_config")
    .select("api_key, api_base_url, enabled")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

export async function POST(request: NextRequest) {
  const email = await resolveEmail(request);
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error: upsertError } = await admin.from("sreality_config").upsert(
    {
      id: 1,
      api_key: body.apiKey || null,
      api_base_url: body.apiBaseUrl || null,
      enabled: Boolean(body.enabled),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
