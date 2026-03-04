import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAdmin(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email === adminEmail;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  let email: string | undefined;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    email = user?.email;
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    email = session?.user?.email;
  }
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("app_config")
    .select("smsbrana_login, smsbrana_password, vapi_api_key, vapi_assistant_id, vapi_phone_number_id, vapi_minutes_before")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let email: string | undefined;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    email = user?.email;
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    email = session?.user?.email;
  }
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error: upsertError } = await admin.from("app_config").upsert(
    {
      id: 1,
      smsbrana_login: body.smsbranaLogin || null,
      smsbrana_password: body.smsbranaPassword || null,
      vapi_api_key: body.vapiApiKey || null,
      vapi_assistant_id: body.vapiAssistantId || null,
      vapi_phone_number_id: body.vapiPhoneNumberId || null,
      vapi_minutes_before: body.vapiMinutesBefore ? parseInt(body.vapiMinutesBefore, 10) : 30,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
