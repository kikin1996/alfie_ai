import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notify } from "@/lib/notify";
import { shortCode } from "@/lib/shortCode";
import Anthropic from "@anthropic-ai/sdk";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").trim();
}

type Intent = "confirmed" | "declined" | "uncertain";

async function classifyIntent(message: string): Promise<{ intent: Intent; confirmedLabel: string; reason: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback na keyword matching pokud není API klíč
    const t = message.trim().toUpperCase();
    if (/\b(ANO|YES|OK|POTVRZUJI|POTVRZUJU|DORAZÍM|DORAZIM|PRIJDU|PŘIJDU)\b/.test(t)) {
      return { intent: "confirmed", confirmedLabel: "ANO", reason: "keyword match" };
    }
    if (/\b(NE|NO|CANCEL|NEDORAZÍM|NEDORAZIM|NEPRIJDU|NEPŘIJDU|ZRUŠIT|STORNO)\b/.test(t)) {
      return { intent: "declined", confirmedLabel: "NE", reason: "keyword match" };
    }
    return { intent: "uncertain", confirmedLabel: "MOŽNÁ", reason: "no clear keyword" };
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `SMS od českého klienta realitní prohlídky. Urči záměr:
- confirmed: potvrdil účast (ANO, potvrzuji, dorazím, ok, yes, přijdu...)
- declined: odmítl (NE, nedorazím, zrušit, cancel, no, nepřijdu...)
- uncertain: nejasné nebo část informace

Zpráva: "${message}"

Odpověz POUZE JSON bez jakéhokoli dalšího textu:
{"intent":"confirmed|declined|uncertain","confirmed_label":"ANO|NE|MOŽNÁ","reason":"krátké vysvětlení česky"}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    const parsed = JSON.parse(text.trim());
    return {
      intent: parsed.intent ?? "uncertain",
      confirmedLabel: parsed.confirmed_label ?? "MOŽNÁ",
      reason: parsed.reason ?? "",
    };
  } catch {
    return { intent: "uncertain", confirmedLabel: "MOŽNÁ", reason: "parse error" };
  }
}

// SMSbrána posílá příchozí SMS jako GET nebo POST s query params
export async function GET(request: NextRequest) {
  return handleIncoming(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  let params: URLSearchParams;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    params = new URLSearchParams(text);
  } else {
    // Zkus JSON
    try {
      const json = await request.json();
      params = new URLSearchParams(json);
    } catch {
      params = request.nextUrl.searchParams;
    }
  }
  return handleIncoming(params);
}

async function handleIncoming(params: URLSearchParams): Promise<NextResponse> {
  const number = params.get("number") ?? params.get("phone") ?? params.get("From") ?? "";
  const message = params.get("message") ?? params.get("text") ?? params.get("Body") ?? "";

  if (!number || !message) {
    return NextResponse.json({ ok: true });
  }

  const fromNormalized = normalizePhone(number);

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Najít matching prohlídky podle telefonu (poslední 7 dní, stav sms_sent nebo pending)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: viewings } = await supabaseAdmin
    .from("viewings")
    .select("id, user_id, client_phone, client_name, address, event_start, status, sms2h_sent, sms1h_sent, sms_sent_at")
    .in("status", ["sms_sent", "pending"])
    .gte("event_start", since);

  type Row = {
    id: string; user_id: string; client_phone: string; client_name: string;
    address: string; event_start: string; status: string;
    sms2h_sent?: boolean; sms1h_sent?: boolean; sms_sent_at?: string | null;
  };

  const candidates = ((viewings ?? []) as Row[]).filter(
    (v) => normalizePhone(v.client_phone) === fromNormalized
  );

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, message: "No matching viewing" });
  }

  // Prohlídky, kterým už reálně odešla SMS – na tu klient nejspíš reaguje.
  // (Neplést s prohlídkou, které SMS ještě neodešla → nesmí se omylem potvrdit.)
  const notified = candidates.filter((v) => v.status === "sms_sent" || v.sms2h_sent || v.sms1h_sent);
  const pool = notified.length ? notified : candidates;

  // 1) Spárovat podle kódu prohlídky uvedeného v textu zprávy (např. "ANO 4821")
  const codesInMsg: string[] = message.match(/\d{4}/g) ?? [];
  let viewing: Row | undefined = codesInMsg.length
    ? pool.find((v) => codesInMsg.includes(shortCode(v.id)))
    : undefined;

  // 2) Fallback: nejnovější odeslaná SMS (na tu klient reaguje nejpravděpodobněji)
  if (!viewing) {
    viewing = pool
      .slice()
      .sort((a, b) => new Date(b.sms_sent_at ?? b.event_start).getTime() - new Date(a.sms_sent_at ?? a.event_start).getTime())[0];
  }

  if (!viewing) {
    return NextResponse.json({ ok: true, message: "No matching viewing" });
  }

  // AI klasifikace záměru
  const { intent, confirmedLabel, reason } = await classifyIntent(message).catch(() => ({
    intent: "uncertain" as Intent,
    confirmedLabel: "MOŽNÁ",
    reason: "error",
  }));

  const newStatus =
    intent === "confirmed" ? "confirmed" : intent === "declined" ? "cancelled" : null;

  if (newStatus) {
    await supabaseAdmin
      .from("viewings")
      .update({
        status: newStatus,
        confirmed_at: newStatus === "confirmed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viewing.id);
  }

  // Telegram notifikace brokerovi
  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("whatsapp_phone, whatsapp_apikey, notification_channel, notification_email")
    .eq("user_id", viewing.user_id)
    .maybeSingle();

  if (settings) {
    const name = viewing.client_name || number;
    const code = shortCode(viewing.id);
    const timeStr = new Date(viewing.event_start).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
    await notify(
      settings,
      `Odpověď klienta – ${name} (ID ${code})`,
      `💬 Odpověď klienta: ${name} (${number})\n🔖 ID prohlídky: ${code}\n📍 ${viewing.address}\n🕐 ${timeStr}\n✉️ Zpráva: "${message}"\n→ ${confirmedLabel}${reason ? ` (${reason})` : ""}`
    );
  }

  return NextResponse.json({ ok: true, intent, status: newStatus ?? "unchanged" });
}
