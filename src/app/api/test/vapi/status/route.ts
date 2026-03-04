import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.callId) {
    return NextResponse.json({ error: "Chybí callId" }, { status: 400 });
  }

  // Načíst API key z app_config
  const admin = getSupabaseAdmin();
  const { data: config } = await admin
    .from("app_config")
    .select("vapi_api_key")
    .eq("id", 1)
    .maybeSingle();

  const apiKey = config?.vapi_api_key;
  if (!apiKey) {
    return NextResponse.json({ error: "VAPI API Key není nastaven v administraci" }, { status: 400 });
  }

  const res = await fetch(`https://api.vapi.ai/call/${body.callId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `VAPI chyba: ${err}` }, { status: res.status });
  }

  const call = await res.json();

  // Zjistit odpověď klienta z transkriptu
  let clientResponse: "confirmed" | "cancelled" | "unknown" = "unknown";
  const transcript: string = call.transcript ?? "";
  const lower = transcript.toLowerCase();
  if (/\bano\b/.test(lower) || /\bpotvrzuji\b/.test(lower) || /\bpřijdu\b/.test(lower)) {
    clientResponse = "confirmed";
  } else if (/\bne\b/.test(lower) || /\bzruš\b/.test(lower) || /\bnepřijdu\b/.test(lower)) {
    clientResponse = "cancelled";
  }

  return NextResponse.json({
    status: call.status,
    endedReason: call.endedReason,
    transcript,
    summary: call.analysis?.summary ?? null,
    clientResponse,
    durationSeconds: call.endedAt && call.startedAt
      ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
      : null,
  });
}
