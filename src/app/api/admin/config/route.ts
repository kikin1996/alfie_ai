import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAdmin(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email === adminEmail;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("app_config")
    .select("smsbrana_login, smsbrana_password, vapi_api_key, vapi_assistant_id, vapi_phone_number_id")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json(data ?? {});
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const admin = getSupabaseAdmin();
  await admin.from("app_config").upsert(
    {
      id: 1,
      smsbrana_login: body.smsbranaLogin || null,
      smsbrana_password: body.smsbranaPassword || null,
      vapi_api_key: body.vapiApiKey || null,
      vapi_assistant_id: body.vapiAssistantId || null,
      vapi_phone_number_id: body.vapiPhoneNumberId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  return NextResponse.json({ ok: true });
}
