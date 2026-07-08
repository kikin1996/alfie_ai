import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notify } from "@/lib/notify";
import Anthropic from "@anthropic-ai/sdk";

type Intent = "confirmed" | "declined" | "uncertain";

/**
 * Klasifikace výsledku hovoru přes Claude (spolehlivé pro češtinu vč. negací).
 * Fallback (bez API klíče) řeší negace tak, že NEJDŘÍV hledá odmítnutí.
 */
async function classifyCall(transcript: string, summary: string): Promise<Intent> {
  const text = `${transcript}\n${summary}`.trim();
  if (!text) return "uncertain";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const t = text.toLowerCase();
    // Odmítnutí kontrolovat první (kvůli negacím "nepřijdu" obsahuje "přijdu")
    if (/(nepřijd|neprijd|nedoraz|nezúčast|nezucast|nebudu|nemůž|nemuz|zruš|zrus|bohužel|bohuzel|nestih)/.test(t)) return "declined";
    if (/(přijd|prijd|doraz|potvrz|\bano\b|budu tam|zúčastn|zucastn|jasně|jasne|souhlas)/.test(t)) return "confirmed";
    return "uncertain";
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Toto je přepis telefonního hovoru, kde AI asistent volal klientovi realitní kanceláře kvůli potvrzení prohlídky nemovitosti. Urči, jak klient nakonec odpověděl:
- confirmed: klient potvrdil, že na prohlídku DORAZÍ (ano, přijdu, dorazím, potvrzuji, budu tam...)
- declined: klient řekl, že NEDORAZÍ / chce zrušit (nepřijdu, nedorazím, zrušit, nemůžu...)
- uncertain: nejasné, klient se nevyjádřil jednoznačně, hovor se nedovolal, nebo přepis chybí

Přepis / shrnutí hovoru:
"""
${text.slice(0, 4000)}
"""

Odpověz POUZE jedním slovem: confirmed, declined, nebo uncertain.`,
        },
      ],
    });
    const out = (response.content[0]?.type === "text" ? response.content[0].text : "").trim().toLowerCase();
    if (out.includes("confirmed")) return "confirmed";
    if (out.includes("declined")) return "declined";
    return "uncertain";
  } catch {
    return "uncertain";
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // VAPI posílá data různě (body.message / body.data / rovnou), sáhneme flexibilně.
  const d = ((body.message ?? body.data ?? body) ?? {}) as Record<string, unknown>;
  const artifact = (d.artifact ?? {}) as Record<string, unknown>;
  const analysis = (d.analysis ?? {}) as Record<string, unknown>;
  const metadata = ((d.metadata ?? (d.call as Record<string, unknown>)?.metadata) ?? {}) as Record<string, unknown>;

  // Transkript z více možných míst + fallback poskládání z messages
  let transcript = (artifact.transcript as string) ?? (d.transcript as string) ?? "";
  if (!transcript) {
    const messages = (artifact.messages ?? d.messages ?? []) as { role?: string; message?: string; content?: string }[];
    if (messages.length) {
      transcript = messages
        .filter((m) => m.role && (m.message || m.content))
        .map((m) => `${m.role === "bot" || m.role === "assistant" ? "Asistent" : "Klient"}: ${m.message ?? m.content}`)
        .join("\n");
    }
  }
  const summary = (analysis.summary as string) ?? "";
  const eventId = (metadata.event_id as string) ?? "";
  const phoneE164 = ((d.customer as Record<string, unknown>)?.number as string) ?? "";
  const callStatus = (d.status as string) ?? (d.type as string) ?? "";

  // Zpracovat jen ukončené hovory / závěrečnou zprávu
  const done =
    callStatus === "completed" || callStatus === "ended" || callStatus === "failed" ||
    callStatus === "end-of-call-report" || (d.type as string) === "end-of-call-report";
  if (!done && callStatus) {
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
      .order("event_start", { ascending: true })
      .limit(1);
    viewing = rows?.[0] ?? undefined;
  }

  if (!viewing) {
    return NextResponse.json({ ok: true, message: "Viewing not found" });
  }

  const intent = await classifyCall(transcript, summary);

  // Uložit shrnutí + přepis (ať se zobrazí v kartě). Status měnit JEN u jasného výsledku –
  // při "uncertain" schůzku NErušíme, jen brokera upozorníme.
  const update: Record<string, unknown> = {
    vapi_summary: summary || null,
    vapi_transcript: transcript || null,
    updated_at: new Date().toISOString(),
  };
  if (intent === "confirmed") {
    update.status = "confirmed";
    update.confirmed_at = new Date().toISOString();
  } else if (intent === "declined") {
    update.status = "cancelled";
    update.confirmed_at = null;
  }
  await supabaseAdmin.from("viewings").update(update).eq("id", viewing.id);

  // Notifikace brokerovi
  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("whatsapp_phone, whatsapp_apikey, notification_channel, notification_email")
    .eq("user_id", viewing.user_id)
    .maybeSingle();

  if (settings) {
    const label = intent === "confirmed" ? "✅ POTVRZENO" : intent === "declined" ? "❌ ZRUŠENO" : "❓ NEJASNÉ – ověřte prosím";
    const time = new Date(viewing.event_start).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
    await notify(
      settings,
      `Výsledek hovoru – ${viewing.client_name || phoneE164}`,
      `📞 AI hovor ukončen: ${viewing.client_name || phoneE164}\n📍 ${viewing.address}\n🕐 ${time}\n→ ${label}${summary ? `\n📝 ${summary}` : ""}`
    );
  }

  return NextResponse.json({ ok: true, intent });
}
