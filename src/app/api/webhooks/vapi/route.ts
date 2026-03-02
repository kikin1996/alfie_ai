import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram";

// Heuristika z N8N: rozpoznání potvrzení/odmítnutí z transkriptu
function parseVapiResult(transcript: string, summary: string): { confirmed: boolean; declined: boolean } {
  const text = (transcript + " " + summary).toLowerCase();
  const confirmed = /\b(ano|potvrzuji|potvrzuju|dorazím|dorazim|prijdu|přijdu|confirmed|yes|ok)\b/.test(text);
  const declined = /\b(ne|nedorazím|nedorazim|zrušit|cancel|no|nepřijdu|neprijdu)\b/.test(text);
  return { confirmed, declined };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const d = (body.data ?? {}) as Record<string, unknown>;
  const transcript = (d.transcript as string) ?? "";
  const summary = ((d.analysis as Record<string, unknown>)?.summary as string) ?? "";
  const eventId = ((d.metadata as Record<string, unknown>)?.event_id as string) ?? "";
  const phoneE164 = ((d.customer as Record<string, unknown>)?.number as string) ?? "";
  const callStatus = (d.status as string) ?? "";

  // Ignorovat hovory které ještě neskončily
  if (callStatus !== "completed" && callStatus !== "failed" && callStatus !== "ended") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!eventId && !phoneE164) {
    return NextResponse.json({ ok: true, message: "No event_id or phone" });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Najít prohlídku
  let viewing: { id: string; user_id: string; client_name: string; address: string; event_start: string } | undefined;
  if (eventId) {
    const { data } = await supabaseAdmin
      .from("viewings")
      .select("id, user_id, client_name, address, event_start")
      .eq("id", eventId)
      .maybeSingle();
    viewing = data ?? undefined;
  } else {
    const { data: rows } = await supabaseAdmin
      .from("viewings")
      .select("id, user_id, client_name, address, event_start")
      .eq("client_phone", phoneE164)
      .eq("status", "sms_sent")
      .limit(1);
    viewing = rows?.[0] ?? undefined;
  }

  if (!viewing) {
    return NextResponse.json({ ok: true, message: "Viewing not found" });
  }

  const { confirmed, declined } = parseVapiResult(transcript, summary);

  if (confirmed || declined) {
    const newStatus = confirmed ? "confirmed" : "cancelled";
    await supabaseAdmin
      .from("viewings")
      .update({
        status: newStatus,
        confirmed_at: confirmed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viewing.id);
  }

  // Telegram notifikace
  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("telegram_bot_token, telegram_chat_id")
    .eq("user_id", viewing.user_id)
    .maybeSingle();

  if (settings?.telegram_bot_token && settings?.telegram_chat_id) {
    const label = confirmed ? "✅ ANO" : declined ? "❌ NE" : "❓ MOŽNÁ";
    await sendTelegramMessage(
      settings.telegram_bot_token,
      settings.telegram_chat_id,
      `📞 VAPI hovor ukončen: ${viewing.client_name || phoneE164}\n📍 ${viewing.address}\n→ <b>${label}</b>`
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, confirmed, declined });
}
