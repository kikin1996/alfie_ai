import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();

  // Načíst viewing a vapi_call_id
  const { data: viewing } = await supabaseAdmin
    .from("viewings")
    .select("id, user_id, vapi_call_id, vapi_summary, vapi_transcript")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!viewing) return NextResponse.json({ error: "Prohlídka nenalezena" }, { status: 404 });

  // Pokud už máme uložené výsledky, vrátit je
  if (viewing.vapi_summary || viewing.vapi_transcript) {
    return NextResponse.json({
      summary: viewing.vapi_summary ?? null,
      transcript: viewing.vapi_transcript ?? null,
    });
  }

  if (!viewing.vapi_call_id) {
    return NextResponse.json({ error: "Hovor nebyl zaznamenán (chybí call ID)" }, { status: 404 });
  }

  // Načíst VAPI API key z app_config
  const { data: appConfig } = await supabaseAdmin
    .from("app_config")
    .select("vapi_api_key")
    .eq("id", 1)
    .maybeSingle();

  if (!appConfig?.vapi_api_key) {
    return NextResponse.json({ error: "VAPI API key není nakonfigurován" }, { status: 500 });
  }

  // Načíst výsledky hovoru z VAPI
  const res = await fetch(`https://api.vapi.ai/call/${viewing.vapi_call_id}`, {
    headers: { Authorization: `Bearer ${appConfig.vapi_api_key}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Nepodařilo se načíst výsledky z VAPI" }, { status: 502 });
  }

  const data = await res.json();

  const summary: string | null = data.analysis?.summary ?? null;

  let transcript: string | null = data.artifact?.transcript ?? data.transcript ?? null;
  if (!transcript) {
    const messages: { role?: string; message?: string; content?: string }[] =
      data.artifact?.messages ?? data.messages ?? [];
    if (messages.length > 0) {
      transcript = messages
        .filter((m) => m.role && (m.message || m.content))
        .map((m) => `${m.role === "bot" ? "Asistent" : "Klient"}: ${m.message ?? m.content}`)
        .join("\n");
    }
  }

  // Uložit výsledky do DB pro příště
  if (summary || transcript) {
    await supabaseAdmin
      .from("viewings")
      .update({ vapi_summary: summary, vapi_transcript: transcript, updated_at: new Date().toISOString() })
      .eq("id", params.id);
  }

  return NextResponse.json({ summary: summary ?? null, transcript: transcript ?? null });
}
